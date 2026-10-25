const test = require('node:test');
const assert = require('node:assert/strict');
process.env.BASE_URL = 'https://chat.effectsacademy.com';
process.env.GOOGLE_CLIENT_ID = 'web-client-test';
process.env.GOOGLE_CLIENT_SECRET = 'server-secret-test';
const { createServer } = require('../server');
const { createVault } = require('../lib');

class Collection {
  constructor() { this.items = new Map(); }
  async createIndex() {}
  async insertOne(item) { this.items.set(item._id, item); }
  async findOne(query) {
    const item = this.items.get(query._id);
    if (!item || query.expiresAt?.$gt && item.expiresAt <= query.expiresAt.$gt) return null;
    return { ...item };
  }
  async updateOne(query, changes, options = {}) {
    let item = this.items.get(query._id);
    if (!item && !options.upsert) return { matchedCount: 0 };
    if (!item) item = { _id: query._id, ...changes.$setOnInsert };
    Object.assign(item, changes.$set || {});
    for (const key of Object.keys(changes.$unset || {})) delete item[key];
    this.items.set(query._id, item);
    return { matchedCount: 1 };
  }
  async deleteOne(query) { this.items.delete(query._id); }
}

test('Twitch device sign-in and external Google callback link to one dock account', async () => {
  const collections = new Map();
  const db = { collection(name) {
    if (!collections.has(name)) collections.set(name, new Collection());
    return collections.get(name);
  } };
  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    const address = String(url);
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    if (address === 'https://id.twitch.tv/oauth2/device') return json({
      device_code: 'private-device-code', user_code: 'ABC123',
      verification_uri: 'https://www.twitch.tv/activate?device-code=ABC123', interval: 0, expires_in: 1800,
    });
    if (address === 'https://id.twitch.tv/oauth2/token') {
      assert.match(options.body, /scopes=chat/);
      return json({ access_token: 'twitch-access', refresh_token: 'twitch-refresh', expires_in: 3600 });
    }
    if (address === 'https://id.twitch.tv/oauth2/validate') return json({
      client_id: 'biqb5fsffboof3cn3xujin6yur12i2', user_id: '123', login: 'streamer',
    });
    if (address === 'https://oauth2.googleapis.com/token') return json({
      access_token: 'google-access', refresh_token: 'google-refresh', expires_in: 3600,
    });
    if (address.startsWith('https://www.googleapis.com/youtube/v3/channels')) return json({ items: [{ id: 'UC123' }] });
    return originalFetch(url, options);
  };
  const app = await createServer({ db, vault: createVault('cd'.repeat(32)) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (route, data, session) => fetch(`${origin}${route}`, { method: 'POST', headers: {
    Origin: process.env.BASE_URL, 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}),
  }, body: JSON.stringify(data) });
  try {
    const started = await post('/auth/twitch/start', {});
    assert.equal(started.status, 200);
    assert.equal((await started.json()).userCode, 'ABC123');
    const deviceCookie = started.headers.get('set-cookie').split(';')[0];
    const completed = await fetch(`${origin}/auth/twitch/status`, { headers: { Cookie: deviceCookie } });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).signedIn, true);
    const session = completed.headers.get('set-cookie').split(';')[0];
    const before = await fetch(`${origin}/api/state`, { headers: { Cookie: session } });
    assert.equal((await before.json()).youtubeConnected, false);

    const link = await post('/api/youtube/link', {}, session);
    const { url } = await link.json();
    const start = await fetch(url.replace(process.env.BASE_URL, origin), { redirect: 'manual' });
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${origin}/auth/youtube/callback?code=fake-code&state=${state}`);
    assert.equal(callback.status, 200);
    const after = await fetch(`${origin}/api/state`, { headers: { Cookie: session } });
    assert.equal((await after.json()).youtubeConnected, true);
    const replay = await fetch(`${origin}/auth/youtube/callback?code=fake-code&state=${state}`);
    assert.equal(replay.status, 400);
    const disconnected = await post('/api/youtube/disconnect', {}, session);
    assert.equal(disconnected.status, 200);
    const finalState = await fetch(`${origin}/api/state`, { headers: { Cookie: session } });
    assert.equal((await finalState.json()).youtubeConnected, false);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
  }
});
