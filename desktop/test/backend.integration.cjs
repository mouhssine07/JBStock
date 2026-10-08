const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { join, resolve, dirname, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { Backend } = require('../src/backend.cjs');

test('real Java process persists profile across two graceful Windows lifecycles', { timeout: 90000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'jbstock-desktop-'));
  const options = { java: process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java.exe') : 'java',
    jar: resolve('../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar'), home };
  const profile = { name: 'Desktop persistence demo', address: 'Fictional', phone: '', email: '', fiscalIdentifiers: [] };
  let backend;
  try {
    backend = new Backend();
    await backend.start(options);
    assert.deepEqual(await backend.saveCompany(profile), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
    backend = new Backend();
    await backend.start(options);
    assert.deepEqual(await backend.company(), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
    assert.match(await readFile(join(home, 'logs/jbstock.log'), 'utf8'), /LOGGING_STOPPED/);
  } finally {
    if (backend) await backend.stop();
    assert.equal(dirname(resolve(home)), resolve(tmpdir()));
    assert.ok(basename(home).startsWith('jbstock-desktop-'));
    await rm(home, { recursive: true, force: true });
  }
});
