const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const path = require('node:path');
const { randomToken, digest, createVault, parseIrc, safeMessage } = require('./lib');

const BASE_URL = process.env.BASE_URL || '';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'biqb5fsffboof3cn3xujin6yur12i2';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = `${BASE_URL}/auth/youtube/callback`;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const TWITCH_SCOPES = 'chat:read chat:edit moderator:manage:banned_users';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';

function mustConfigure() {
  if (!/^https:\/\/[^/]+$/.test(BASE_URL)) throw new Error('BASE_URL must be the HTTPS origin of the chat service');
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is required');
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Google Web OAuth credentials are required');
  return createVault(process.env.TOKEN_ENCRYPTION_KEY);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = data.error_description || data.message || data.error?.message || data.error || `HTTP ${response.status}`;
    const error = new Error(typeof description === 'string' ? description : `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const form = (data) => new URLSearchParams(data).toString();
const cookies = (request) => Object.fromEntries((request.headers.cookie || '').split(';').map((item) => item.trim().split('=')));
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

async function createServer({ db, vault }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.set({
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://7tv.io; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.use((request, response, next) => {
    if (request.method !== 'POST' || request.headers.origin === BASE_URL) return next();
    return response.status(403).json({ error: 'Invalid origin' });
  });

  const users = db.collection('users');
  const sessions = db.collection('sessions');
  const flows = db.collection('flows');
  const pairs = db.collection('pairs');
  const states = db.collection('oauth_states');
  await Promise.all([sessions, flows, pairs, states].map((collection) => collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })));
  const workers = new Map();
  const refreshes = new Map();
  const startAttempts = new Map();

  async function currentUser(request) {
    const raw = cookies(request).bs_session;
    if (!raw || raw.length > 100) return null;
    const session = await sessions.findOne({ _id: digest(raw), expiresAt: { $gt: new Date() } });
    return session ? users.findOne({ _id: session.userId }) : null;
  }

  async function requireUser(request, response, next) {
    try {
      request.user = await currentUser(request);
      if (!request.user) return response.status(401).json({ error: 'Sign in to Twitch first.' });
      next();
    } catch (error) { next(error); }
  }

  async function saveSession(response, userId) {
    const token = randomToken();
    await sessions.insertOne({ _id: digest(token), userId, expiresAt: new Date(Date.now() + SESSION_MS) });
    response.setHeader('Set-Cookie', cookie('bs_session', token, SESSION_MS / 1000));
  }

  async function accessToken(user, provider) {
    const sealed = user[provider];
    if (!sealed) throw new Error(`${provider} is not connected`);
    let bundle = vault.open(sealed);
    if (bundle.expiresAt > Date.now() + 60000) return bundle.access_token;
    const key = `${user._id}:${provider}`;
    if (!refreshes.has(key)) {
      const task = (async () => {
        const current = await users.findOne({ _id: user._id });
        bundle = vault.open(current[provider]);
        if (bundle.expiresAt > Date.now() + 60000) return bundle.access_token;
        const endpoint = provider === 'twitch' ? 'https://id.twitch.tv/oauth2/token' : 'https://oauth2.googleapis.com/token';
        const body = provider === 'twitch'
          ? { client_id: TWITCH_CLIENT_ID, grant_type: 'refresh_token', refresh_token: bundle.refresh_token }
          : { client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: bundle.refresh_token };
        const updated = await requestJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(body) });
        bundle = { access_token: updated.access_token, refresh_token: updated.refresh_token || bundle.refresh_token,
          expiresAt: Date.now() + updated.expires_in * 1000 };
        const encrypted = vault.seal(bundle);
        await users.updateOne({ _id: user._id }, { $set: { [provider]: encrypted } });
        user[provider] = encrypted;
        return bundle.access_token;
      })();
      refreshes.set(key, task);
      task.finally(() => refreshes.delete(key)).catch(() => {});
    }
    return refreshes.get(key);
  }

  async function twitchApi(user, endpoint, options = {}) {
    const token = await accessToken(user, 'twitch');
    return requestJson(`https://api.twitch.tv/helix${endpoint}`, {
      ...options, headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  }

  async function youtubeApi(user, endpoint, options = {}) {
    const token = await accessToken(user, 'youtube');
    return requestJson(`https://www.googleapis.com/youtube/v3${endpoint}`, {
      ...options, headers: { Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  }

  class ChatWorker {
    constructor(user) {
      this.user = user;
      this.clients = new Set();
      this.messages = [];
      this.status = { twitch: false, youtube: false };
      this.closed = false;
      this.youtubeChatId = null;
      this.youtubePageToken = null;
      this.youtubeRefreshAt = 0;
      this.lastTwitchId = '';
      this.startTwitch();
      this.pollYoutube();
    }
    publish() {
      const data = `data: ${JSON.stringify({ messages: this.messages, status: this.status,
        youtubeConnected: Boolean(this.user.youtube), name: this.user.name, twitchId: this.user._id })}\n\n`;
      for (const client of this.clients) client.write(data);
    }
    add(message) {
      if (this.messages.some((item) => item.id === message.id)) return;
      this.messages.push(safeMessage(message));
      if (this.messages.length > 300) this.messages.shift();
      this.publish();
    }
    remove(predicate) {
      this.messages = this.messages.filter((item) => !predicate(item));
      this.publish();
    }
    async startTwitch() {
      if (this.closed) return;
      try {
        this.user = await users.findOne({ _id: this.user._id });
        const token = await accessToken(this.user, 'twitch');
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        this.twitch = ws;
        ws.on('open', () => {
          ws.send(`PASS oauth:${token}`);
          ws.send(`NICK ${this.user.login}`);
          ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
          ws.send(`JOIN #${this.user.login}`);
          this.status.twitch = true;
          this.publish();
        });
        ws.on('message', (data) => {
          for (const line of String(data).split('\r\n')) {
            if (line.startsWith('PING ')) { ws.send(line.replace('PING', 'PONG')); continue; }
            const item = parseIrc(line);
            if (!item) continue;
            if (item.command === 'PRIVMSG') this.add({ platform: 'twitch', id: item.tags.id,
              author: item.tags['display-name'] || item.prefix.split('!')[0], authorId: item.tags['user-id'],
              text: item.text, emotes: item.tags.emotes || '' });
            if (item.command === 'CLEARCHAT') this.remove((message) => message.platform === 'twitch' &&
              (!item.tags['target-user-id'] || message.authorId === item.tags['target-user-id']));
            if (item.command === 'CLEARMSG') this.remove((message) => message.id === item.tags['target-msg-id']);
          }
        });
        ws.on('error', () => {});
        ws.on('close', () => {
          if (this.twitch === ws) this.twitch = null;
          this.status.twitch = false;
          this.publish();
          if (!this.closed) this.twitchTimer = setTimeout(() => this.startTwitch(), 5000);
        });
      } catch (_error) { if (!this.closed) this.twitchTimer = setTimeout(() => this.startTwitch(), 15000); }
    }
    async pollYoutube() {
      if (this.closed) return;
      let delay = 30000;
      try {
        this.user = await users.findOne({ _id: this.user._id });
        if (this.user.youtube) {
          if (!this.youtubeChatId || Date.now() > this.youtubeRefreshAt) {
            const broadcasts = await youtubeApi(this.user, '/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&maxResults=50');
            const id = broadcasts.items?.find((item) => item.snippet?.liveChatId)?.snippet.liveChatId || null;
            if (id !== this.youtubeChatId) this.youtubePageToken = null;
            this.youtubeChatId = id;
            this.youtubeRefreshAt = Date.now() + 60000;
          }
          if (this.youtubeChatId) {
            const query = new URLSearchParams({ liveChatId: this.youtubeChatId, part: 'snippet,authorDetails', maxResults: '200' });
            if (this.youtubePageToken) query.set('pageToken', this.youtubePageToken);
            const page = await youtubeApi(this.user, `/liveChat/messages?${query}`);
            this.youtubePageToken = page.nextPageToken;
            for (const item of page.items || []) {
              const kind = item.snippet?.type;
              if (kind === 'userBannedEvent') this.remove((message) => message.platform === 'youtube' &&
                message.authorId === item.snippet.userBannedDetails?.bannedUserDetails?.channelId);
              else if (kind === 'messageDeletedEvent') this.remove((message) => message.id === item.snippet.messageDeletedDetails?.deletedMessageId);
              else if (kind === 'textMessageEvent') this.add({ platform: 'youtube', id: item.id,
                author: item.authorDetails?.displayName, authorId: item.authorDetails?.channelId,
                text: item.snippet.displayMessage, at: Date.parse(item.snippet.publishedAt) });
            }
            delay = Math.max(3000, page.pollingIntervalMillis || 5000);
            this.status.youtube = true;
          } else this.status.youtube = false;
        } else this.status.youtube = false;
      } catch (_error) { this.status.youtube = false; delay = 30000; }
      this.publish();
      if (!this.closed) this.youtubeTimer = setTimeout(() => this.pollYoutube(), delay);
    }
    close() {
      this.closed = true;
      clearTimeout(this.youtubeTimer);
      clearTimeout(this.twitchTimer);
      this.twitch?.close();
      for (const client of this.clients) client.end();
      this.clients.clear();
    }
  }

  app.get('/health', (_request, response) => response.json({ ok: true }));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

  app.post('/auth/twitch/start', async (request, response, next) => {
    try {
      const ip = request.ip;
      const attempts = (startAttempts.get(ip) || []).filter((at) => at > Date.now() - 300000);
      if (attempts.length >= 5) return response.status(429).json({ error: 'Please wait before starting another sign-in.' });
      attempts.push(Date.now()); startAttempts.set(ip, attempts);
      const device = await requestJson('https://id.twitch.tv/oauth2/device', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ client_id: TWITCH_CLIENT_ID, scopes: TWITCH_SCOPES }) });
      const token = randomToken();
      await flows.insertOne({ _id: digest(token), deviceCode: vault.seal(device.device_code),
        userCode: device.user_code, verificationUri: device.verification_uri,
        nextPoll: Date.now() + device.interval * 1000, interval: device.interval * 1000,
        expiresAt: new Date(Date.now() + device.expires_in * 1000) });
      response.setHeader('Set-Cookie', cookie('bs_device', token, device.expires_in));
      response.json({ userCode: device.user_code, verificationUri: device.verification_uri });
    } catch (error) { next(error); }
  });

  app.get('/auth/twitch/status', async (request, response, next) => {
    try {
      const token = cookies(request).bs_device;
      const flow = token && await flows.findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
      if (!flow) return response.status(404).json({ error: 'Sign-in expired.' });
      if (Date.now() < flow.nextPoll) return response.json({ pending: true });
      await flows.updateOne({ _id: flow._id, nextPoll: flow.nextPoll }, { $set: { nextPoll: Date.now() + flow.interval } });
      let grant;
      try {
        grant = await requestJson('https://id.twitch.tv/oauth2/token', { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form({ client_id: TWITCH_CLIENT_ID, scopes: TWITCH_SCOPES, device_code: vault.open(flow.deviceCode),
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }) });
      } catch (error) {
        if (error.message === 'authorization_pending') return response.json({ pending: true });
        throw error;
      }
      const identity = await requestJson('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${grant.access_token}` },
      });
      if (identity.client_id !== TWITCH_CLIENT_ID) throw new Error('Unexpected Twitch client');
      const user = await users.findOne({ _id: identity.user_id });
      await users.updateOne({ _id: identity.user_id }, { $set: { name: identity.login, login: identity.login,
        twitch: vault.seal({ access_token: grant.access_token, refresh_token: grant.refresh_token,
          expiresAt: Date.now() + grant.expires_in * 1000 }) }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      await flows.deleteOne({ _id: flow._id });
      if (user && workers.has(user._id)) workers.get(user._id).close();
      workers.delete(identity.user_id);
      await saveSession(response, identity.user_id);
      response.json({ signedIn: true });
    } catch (error) { next(error); }
  });

  app.get('/api/state', requireUser, (request, response) => {
    const worker = workers.get(request.user._id);
    response.json({ name: request.user.name, twitchId: request.user._id, youtubeConnected: Boolean(request.user.youtube),
      status: worker?.status || { twitch: false, youtube: false }, messages: worker?.messages || [] });
  });

  app.get('/api/events', requireUser, (request, response) => {
    let worker = workers.get(request.user._id);
    if (!worker) { worker = new ChatWorker(request.user); workers.set(request.user._id, worker); }
    clearTimeout(worker.stopTimer);
    response.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'Cache-Control': 'no-store' });
    worker.clients.add(response);
    worker.publish();
    const heartbeat = setInterval(() => response.write(': keepalive\n\n'), 20000);
    request.on('close', () => {
      clearInterval(heartbeat);
      worker.clients.delete(response);
      if (!worker.clients.size) worker.stopTimer = setTimeout(() => {
        if (!worker.clients.size) { worker.close(); workers.delete(request.user._id); }
      }, 30000);
    });
  });

  app.post('/api/youtube/link', requireUser, async (request, response, next) => {
    try {
      const token = randomToken();
      await pairs.insertOne({ _id: digest(token), userId: request.user._id, expiresAt: new Date(Date.now() + 600000) });
      response.json({ url: `${BASE_URL}/auth/youtube/start?pair=${token}` });
    } catch (error) { next(error); }
  });

  app.get('/auth/youtube/start', async (request, response, next) => {
    try {
      const pair = request.query.pair && await pairs.findOne({ _id: digest(String(request.query.pair)), expiresAt: { $gt: new Date() } });
      if (!pair) return response.status(400).send('This YouTube connection link has expired. Generate a new one in the OBS dock.');
      const state = randomToken();
      await states.insertOne({ _id: digest(state), userId: pair.userId, expiresAt: new Date(Date.now() + 600000) });
      await pairs.deleteOne({ _id: pair._id });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code', access_type: 'offline', prompt: 'consent', scope: GOOGLE_SCOPE, state }).toString();
      response.redirect(url.href);
    } catch (error) { next(error); }
  });

  app.get('/auth/youtube/callback', async (request, response, next) => {
    try {
      const state = request.query.state && await states.findOne({ _id: digest(String(request.query.state)), expiresAt: { $gt: new Date() } });
      if (!state || !request.query.code) return response.status(400).send('YouTube authorization was cancelled or expired.');
      await states.deleteOne({ _id: state._id });
      const grant = await requestJson('https://oauth2.googleapis.com/token', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ code: String(request.query.code), client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) });
      const existing = await users.findOne({ _id: state.userId });
      const previous = existing?.youtube ? vault.open(existing.youtube) : {};
      const bundle = { access_token: grant.access_token, refresh_token: grant.refresh_token || previous.refresh_token,
        expiresAt: Date.now() + grant.expires_in * 1000 };
      if (!bundle.refresh_token) throw new Error('Google did not provide a refresh token. Reconnect YouTube.');
      const channel = await requestJson('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
        headers: { Authorization: `Bearer ${grant.access_token}` },
      });
      if (!channel.items?.length) throw new Error('This Google account has no YouTube channel.');
      await users.updateOne({ _id: state.userId }, { $set: { youtube: vault.seal(bundle) } });
      response.send('<!doctype html><title>YouTube connected</title><p>YouTube is connected to BitStudio chat. You can close this tab.</p>');
    } catch (error) { next(error); }
  });

  app.post('/api/youtube/disconnect', requireUser, async (request, response, next) => {
    try {
      await users.updateOne({ _id: request.user._id }, { $unset: { youtube: '' } });
      const worker = workers.get(request.user._id);
      if (worker) {
        worker.user.youtube = null;
        worker.youtubeChatId = null;
        worker.youtubePageToken = null;
        worker.status.youtube = false;
        worker.remove((message) => message.platform === 'youtube');
      }
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/api/send', requireUser, async (request, response, next) => {
    try {
      const text = String(request.body.text || '').trim();
      const platform = request.body.platform;
      if (!text || text.length > 450 || !['twitch', 'youtube', 'both'].includes(platform)) return response.status(400).json({ error: 'Invalid message.' });
      const worker = workers.get(request.user._id);
      const results = {};
      if (platform !== 'youtube') {
        if (worker?.twitch?.readyState !== WebSocket.OPEN) results.twitch = 'Twitch chat is not connected.';
        else worker.twitch.send(`PRIVMSG #${request.user.login} :${text.replace(/[\r\n]/g, ' ')}`);
      }
      if (platform !== 'twitch') {
        if (!worker?.youtubeChatId) results.youtube = 'No active YouTube live chat.';
        else {
          try {
            await youtubeApi(request.user, '/liveChat/messages?part=snippet', { method: 'POST',
              body: JSON.stringify({ snippet: { liveChatId: worker.youtubeChatId, type: 'textMessageEvent', textMessageDetails: { messageText: text } } }) });
          } catch (error) { results.youtube = error.message; }
        }
      }
      response.json({ errors: results });
    } catch (error) { next(error); }
  });

  app.post('/api/moderate', requireUser, async (request, response, next) => {
    try {
      const { platform, authorId, action, duration } = request.body;
      if (!['twitch', 'youtube'].includes(platform) || !/^[A-Za-z0-9_-]{1,100}$/.test(String(authorId)) ||
        !['ban', 'timeout'].includes(action) || (action === 'timeout' && ![600, 3600].includes(duration))) {
        return response.status(400).json({ error: 'Invalid moderation target.' });
      }
      const worker = workers.get(request.user._id);
      if (!worker?.messages.some((item) => item.platform === platform && item.authorId === authorId)) {
        return response.status(400).json({ error: 'That user is no longer in the current chat.' });
      }
      if (platform === 'twitch') {
        await twitchApi(request.user, `/moderation/bans?broadcaster_id=${request.user._id}&moderator_id=${request.user._id}`,
          { method: 'POST', body: JSON.stringify({ data: { user_id: authorId, ...(action === 'timeout' ? { duration } : {}) } }) });
      } else {
        if (!worker.youtubeChatId) throw new Error('No active YouTube live chat.');
        await youtubeApi(request.user, '/liveChat/bans?part=snippet', { method: 'POST', body: JSON.stringify({
          snippet: { liveChatId: worker.youtubeChatId, type: action === 'ban' ? 'permanent' : 'temporary',
            bannedUserDetails: { channelId: authorId }, ...(action === 'timeout' ? { banDurationSeconds: duration } : {}) },
        }) });
      }
      worker.remove((item) => item.platform === platform && item.authorId === authorId);
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/auth/logout', requireUser, async (request, response, next) => {
    try {
      await sessions.deleteOne({ _id: digest(cookies(request).bs_session) });
      response.setHeader('Set-Cookie', cookie('bs_session', '', 0));
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.use((error, _request, response, _next) => {
    console.error('Chat request failed:', error.message);
    response.status(error.status >= 400 && error.status < 500 ? error.status : 500)
      .json({ error: error.status >= 400 && error.status < 500 ? error.message : 'Chat service is temporarily unavailable.' });
  });
  return app;
}

if (require.main === module) {
  (async () => {
    const vault = mustConfigure();
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const app = await createServer({ db: client.db(process.env.DB_NAME || 'bitstudio_chat'), vault });
    app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { createServer, mustConfigure };
