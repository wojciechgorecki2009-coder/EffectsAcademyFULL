const test = require('node:test');
const assert = require('node:assert/strict');
process.env.BASE_URL = 'https://chat.effectsacademy.com';
const { createServer } = require('../server');
const { createVault } = require('../lib');

test('hosted dock serves its page and protects actions', async () => {
  const db = { collection: () => ({ createIndex: async () => {}, findOne: async () => null }) };
  const app = await createServer({ db, vault: createVault('ab'.repeat(32)) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${origin}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /BitStudio Multichat/);
    const rejected = await fetch(`${origin}/api/send`, { method: 'POST',
      headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(rejected.status, 403);
    const unauthenticated = await fetch(`${origin}/api/send`, { method: 'POST',
      headers: { Origin: process.env.BASE_URL, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unauthenticated.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
