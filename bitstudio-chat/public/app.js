const $ = (selector) => document.querySelector(selector);
let signedIn = false;
let connectedYoutube = false;
let currentMessages = [];
let currentMenu = null;
let deviceTimer = null;
let sevenTvEmotes = new Map();
let loadedEmotesFor = null;

function notice(message) {
  const box = $('#notice');
  box.textContent = message;
  box.classList.remove('hidden');
  clearTimeout(box.timer);
  box.timer = setTimeout(() => box.classList.add('hidden'), 5000);
}

async function api(route, data) {
  const response = await fetch(route, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

function renderMessages(messages) {
  const list = $('#messages');
  const bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  list.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = signedIn ? 'Waiting for messages...' : 'Connect Twitch to see chat.';
    list.append(empty);
  }
  for (const message of messages) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = message.id;
    const badge = document.createElement('span');
    badge.className = `badge ${message.platform}`;
    badge.textContent = message.platform === 'twitch' ? 'T' : 'Y';
    const author = document.createElement('button');
    author.type = 'button';
    author.className = 'author';
    author.textContent = message.author || 'Viewer';
    author.title = `Moderate ${message.author || 'viewer'}`;
    author.addEventListener('click', () => moderationMenu(author, message));
    const text = document.createElement('span');
    text.className = 'text';
    text.append(document.createTextNode(': '));
    if (message.platform === 'twitch') appendTwitchText(text, message.text, message.emotes);
    else text.append(document.createTextNode(message.text));
    row.append(badge, author, text);
    list.append(row);
  }
  if (bottom) list.scrollTop = list.scrollHeight;
}

function appendSevenTvText(container, value) {
  for (const part of value.split(/(\s+)/)) {
    const url = sevenTvEmotes.get(part);
    if (!url) { container.append(document.createTextNode(part)); continue; }
    const image = document.createElement('img');
    image.className = 'emote'; image.src = url; image.alt = part; image.title = `7TV: ${part}`;
    container.append(image);
  }
}

function appendTwitchText(container, value, emotes) {
  const spans = [];
  for (const group of String(emotes || '').split('/')) {
    const [id, positions] = group.split(':');
    if (!/^[a-zA-Z0-9_]+$/.test(id || '')) continue;
    for (const position of String(positions || '').split(',')) {
      const match = position.match(/^(\d+)-(\d+)$/);
      if (!match) continue;
      const start = Number(match[1]); const end = Number(match[2]) + 1;
      if (start < end && end <= value.length) spans.push({ id, start, end });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  let index = 0;
  for (const span of spans) {
    if (span.start < index) continue;
    appendSevenTvText(container, value.slice(index, span.start));
    const image = document.createElement('img');
    image.className = 'emote';
    image.src = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(span.id)}/static/dark/1.0`;
    image.alt = value.slice(span.start, span.end); image.title = image.alt;
    container.append(image);
    index = span.end;
  }
  appendSevenTvText(container, value.slice(index));
}

async function loadSevenTv(channelId) {
  if (!/^\d+$/.test(channelId) || loadedEmotesFor === channelId) return;
  loadedEmotesFor = channelId;
  const urls = ['https://7tv.io/v3/emote-sets/global', `https://7tv.io/v3/users/twitch/${channelId}`];
  const sets = await Promise.all(urls.map(async (url) => {
    try { const response = await fetch(url); return response.ok ? response.json() : null; }
    catch (_error) { return null; }
  }));
  sevenTvEmotes = new Map(sets.flatMap((set) => (set?.emote_set || set)?.emotes || [])
    .filter((emote) => /^[a-zA-Z0-9]{16,32}$/.test(emote.id || '') && /^\S{1,64}$/.test(emote.name || ''))
    .map((emote) => [emote.name, `https://cdn.7tv.app/emote/${emote.id}/1x.webp`]));
  renderMessages(currentMessages);
}

function moderationMenu(anchor, message) {
  currentMenu?.remove();
  const menu = document.createElement('div');
  menu.className = 'moderation';
  for (const [label, action, duration] of [['Timeout 10 minutes', 'timeout', 600],
    ['Timeout 1 hour', 'timeout', 3600], ['Ban', 'ban', 0]]) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('click', async () => {
      menu.remove(); currentMenu = null;
      if (action === 'ban' && !confirm(`Ban ${message.author} from ${message.platform} chat?`)) return;
      try { await api('/api/moderate', { platform: message.platform, authorId: message.authorId, action, duration }); }
      catch (error) { notice(error.message); }
    });
    menu.append(button);
  }
  document.body.append(menu);
  currentMenu = menu;
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${rect.bottom + menu.offsetHeight > innerHeight ? rect.top - menu.offsetHeight : rect.bottom}px`;
}

function applyState(state) {
  signedIn = true;
  connectedYoutube = state.youtubeConnected;
  $('#account-name').textContent = `Signed in as ${state.name}`;
  $('#twitch-connect').textContent = 'Reconnect Twitch';
  $('#youtube-connect').textContent = connectedYoutube ? 'Reconnect YouTube' : 'Connect YouTube';
  $('#youtube-disconnect').classList.toggle('hidden', !connectedYoutube);
  $('#logout').classList.remove('hidden');
  $('#twitch-dot').classList.toggle('connected', Boolean(state.status.twitch));
  $('#youtube-dot').classList.toggle('connected', Boolean(state.status.youtube));
  currentMessages = state.messages;
  renderMessages(currentMessages);
  loadSevenTv(state.twitchId);
}

function connectEvents() {
  const events = new EventSource('/api/events');
  events.onmessage = (event) => {
    try { applyState(JSON.parse(event.data)); } catch (_error) {}
  };
  events.onerror = () => {
    $('#twitch-dot').classList.remove('connected');
    $('#youtube-dot').classList.remove('connected');
  };
}

async function refreshState() {
  try { applyState(await api('/api/state')); connectEvents(); }
  catch (_error) { $('#accounts').classList.remove('hidden'); }
}

$('#settings-button').addEventListener('click', () => $('#accounts').classList.toggle('hidden'));
$('#twitch-connect').addEventListener('click', async () => {
  try {
    const flow = await api('/auth/twitch/start', {});
    $('#device-code').textContent = flow.userCode;
    $('#device-url').href = flow.verificationUri;
    $('#device-url').textContent = flow.verificationUri;
    $('#device-panel').classList.remove('hidden');
    clearInterval(deviceTimer);
    deviceTimer = setInterval(async () => {
      try {
        const status = await api('/auth/twitch/status');
        if (status.signedIn) { clearInterval(deviceTimer); $('#device-panel').classList.add('hidden'); location.reload(); }
      } catch (error) { clearInterval(deviceTimer); notice(error.message); }
    }, 5000);
  } catch (error) { notice(error.message); }
});

$('#youtube-connect').addEventListener('click', async () => {
  try {
    const { url } = await api('/api/youtube/link', {});
    $('#youtube-url').value = url;
    $('#youtube-panel').classList.remove('hidden');
  } catch (error) { notice(error.message); }
});

$('#copy-youtube-url').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#youtube-url').value); notice('Connection link copied'); }
  catch (_error) { $('#youtube-url').select(); notice('Select and copy this link into your regular browser.'); }
});

$('#youtube-disconnect').addEventListener('click', async () => {
  if (!confirm('Disconnect YouTube from this chat dock?')) return;
  try { await api('/api/youtube/disconnect', {}); location.reload(); }
  catch (error) { notice(error.message); }
});

$('#logout').addEventListener('click', async () => {
  try { await api('/auth/logout', {}); location.reload(); } catch (error) { notice(error.message); }
});

$('#composer').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#message');
  const text = input.value.trim();
  if (!text) return;
  try {
    const result = await api('/api/send', { text, platform: $('#destination').value });
    input.value = '';
    if (Object.keys(result.errors).length) notice(Object.values(result.errors).join(' '));
  } catch (error) { notice(error.message); }
});

document.addEventListener('click', (event) => {
  if (currentMenu && !currentMenu.contains(event.target) && !event.target.closest('.author')) {
    currentMenu.remove(); currentMenu = null;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentMenu) { currentMenu.remove(); currentMenu = null; }
});

refreshState();
