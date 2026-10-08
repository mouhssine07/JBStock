const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { Backend } = require('../src/backend.cjs');
function options(mode) { return { command: process.execPath, args: [join(__dirname, 'fake-backend.cjs'), mode], home: __dirname }; }
test('supervisor authenticates and shuts down over inherited stdin', async () => {
  const backend = new Backend();
  try {
    await backend.start(options('normal'));
    assert.equal((await backend.company()).name, 'Fake demo');
    assert.deepEqual(await backend.stop(2000), { forced: false });
    await assert.rejects(() => backend.company(), /BACKEND_UNAVAILABLE/);
  } finally { await backend.stop(1000); }
});
test('startup rejects structured failure and invalid authentication', async () => {
  for (const mode of ['failure', 'bad-auth']) {
    const backend = new Backend();
    await assert.rejects(() => backend.start(options(mode)), /DATABASE_ERROR|BACKEND_EXITED|BACKEND_REQUEST_FAILED/);
    await backend.stop(1000);
  }
});
test('startup timeout terminates the owned process', async () => {
  const backend = new Backend();
  await assert.rejects(() => backend.start({ ...options('timeout'), timeout: 300 }), /STARTUP_TIMEOUT/);
});
test('unresponsive child is forcibly stopped after the grace period', async () => {
  const backend = new Backend();
  await backend.start(options('ignore-stop'));
  assert.deepEqual(await backend.stop(100), { forced: true });
});
test('crash after readiness notifies the shell and disables requests', async () => {
  const backend = new Backend();
  const crashed = require('node:events').once(backend, 'unexpected-exit');
  await backend.start(options('crash'));
  await crashed;
  await assert.rejects(() => backend.company(), /BACKEND_UNAVAILABLE/);
  await backend.stop();
});
