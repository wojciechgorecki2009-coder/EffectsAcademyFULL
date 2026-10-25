const { createHash, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const randomToken = () => randomBytes(32).toString('base64url');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function createVault(hexKey) {
  const key = Buffer.from(hexKey || '', 'hex');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters');
  return {
    seal(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
    },
    open(value) {
      const [iv, tag, ciphertext] = String(value).split('.').map((part) => Buffer.from(part, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString());
    },
  };
}

function parseIrc(line) {
  const match = line.match(/^(?:@([^ ]+) )?(?::([^ ]+) )?([^ ]+)(?: ([^:][^\r\n]*?))?(?: :([^\r\n]*))?$/);
  if (!match) return null;
  const tags = Object.fromEntries((match[1] || '').split(';').filter(Boolean).map((part) => {
    const [key, ...rest] = part.split('=');
    return [key, rest.join('=').replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')];
  }));
  return { tags, prefix: match[2] || '', command: match[3], params: match[4] || '', text: match[5] || '' };
}

function safeMessage(input) {
  const platform = input.platform === 'youtube' ? 'youtube' : 'twitch';
  return {
    id: String(input.id || randomToken()), platform,
    author: String(input.author || '').slice(0, 100), authorId: String(input.authorId || '').slice(0, 100),
    text: String(input.text || '').slice(0, 2000), emotes: String(input.emotes || '').slice(0, 1000),
    at: Number(input.at || Date.now()),
  };
}

module.exports = { randomToken, digest, escapeHtml, createVault, parseIrc, safeMessage };
