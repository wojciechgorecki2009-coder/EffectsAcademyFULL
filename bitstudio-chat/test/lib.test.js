const test = require('node:test');
const assert = require('node:assert/strict');
const { createVault, escapeHtml, parseIrc, safeMessage } = require('../lib');

test('tokens are encrypted and authenticated', () => {
  const vault = createVault('aa'.repeat(32));
  const sealed = vault.seal({ token: 'private' });
  assert.doesNotMatch(sealed, /private/);
  assert.deepEqual(vault.open(sealed), { token: 'private' });
  const parts = sealed.split('.');
  parts[1] = 'AAAAAAAAAAAAAAAAAAAAAA';
  assert.throws(() => vault.open(parts.join('.')));
});

test('chat text is escaped before rendering', () => {
  assert.equal(escapeHtml('<img src="x" onerror="alert(1)">'), '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(safeMessage({ platform: 'bad', text: 'hi' }).platform, 'twitch');
});

test('Twitch moderation and chat lines parse', () => {
  const message = parseIrc('@user-id=42;display-name=Name :name!name@name.tmi.twitch.tv PRIVMSG #channel :Hello there');
  assert.equal(message.command, 'PRIVMSG');
  assert.equal(message.tags['user-id'], '42');
  assert.equal(message.text, 'Hello there');
  assert.equal(parseIrc('@target-user-id=42 :tmi.twitch.tv CLEARCHAT #channel :name').command, 'CLEARCHAT');
});
