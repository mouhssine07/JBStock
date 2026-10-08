const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { assetPath, assertSender, validateCompany, APP_URL } = require('../src/security.cjs');

test('local assets cannot escape bundle or use remote origins', () => {
  const root = resolve('test-bundle');
  assert.equal(assetPath('jbstock://app/assets/main.js', root), resolve(root, 'assets/main.js'));
  for (const url of ['https://foreign.example/main.js', 'jbstock://foreign/main.js',
    'jbstock://app/%2e%2e%2fsecret', 'jbstock://app/%5csecret', 'jbstock://app/%00']) {
    assert.throws(() => assetPath(url, root));
  }
});
test('IPC accepts only the exact main frame and window', () => {
  const frame = { url: APP_URL };
  const wc = { mainFrame: frame };
  const window = { webContents: wc, isDestroyed: () => false };
  assert.doesNotThrow(() => assertSender({ sender: wc, senderFrame: frame }, window));
  assert.throws(() => assertSender({ sender: wc, senderFrame: { url: APP_URL } }, window));
  assert.throws(() => assertSender({ sender: {}, senderFrame: frame }, window));
  frame.url = 'https://foreign.example';
  assert.throws(() => assertSender({ sender: wc, senderFrame: frame }, window));
});
test('profile IPC constrains types, sizes and forwarded fields', () => {
  const profile = { name: 'Demo', address: '', phone: '', email: '', fiscalIdentifiers: [] };
  assert.deepEqual(validateCompany({ ...profile, url: 'https://foreign.example' }), profile);
  for (const input of [null, [], { ...profile, name: '' }, { ...profile, address: 'a'.repeat(2001) },
    { ...profile, fiscalIdentifiers: [null] }, { ...profile, fiscalIdentifiers: Array(21).fill({ label: 'a', value: '' }) }]) {
    assert.throws(() => validateCompany(input));
  }
});
