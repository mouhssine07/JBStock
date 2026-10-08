const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { join, resolve, dirname, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const { Backend } = require('../src/backend.cjs');

async function lockDatabase(path) {
  const child = spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-File', join(__dirname, 'lock-database.ps1'), '-DatabasePath', path],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); });
  let output = '';
  let errors = '';
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { errors += value; });
  for (let i = 0; i < 100; i++) {
    if (output.includes('DB_LOCKED')) return async () => { child.stdin.end('\n'); assert.equal(await exit, 0, errors); };
    if (child.exitCode !== null) throw new Error(errors || 'Database lock helper exited');
    await new Promise(done => setTimeout(done, 50));
  }
  child.kill(); await exit;
  throw new Error('Database lock helper timeout');
}

test('Windows exclusively locked database is preserved on startup failure and opens after access is restored', {
  timeout: 180000, skip: process.platform !== 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'jbstock-db-access-'));
  const database = join(root, 'data/jbstock.db');
  const options = { java: resolve(__dirname, '../release/win-unpacked/resources/runtime/bin/java.exe'),
    jar: resolve(__dirname, '../../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar'), home: root };
  const profile = { name: 'Preserved inaccessible fixture', address: '', email: '', phone: '', fiscalIdentifiers: [] };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  let backend;
  let unlock;
  try {
    backend = new Backend();
    await backend.start(options);
    assert.deepEqual(await backend.saveCompany(profile), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
    const before = hash(await readFile(database));
    unlock = await lockDatabase(database);
    backend = new Backend();
    await assert.rejects(() => backend.start(options), /DATABASE_ERROR|MIGRATION_ERROR/);
    await backend.stop();
    const failedLog = await readFile(join(root, 'logs/jbstock.log'), 'utf8');
    assert.match(failedLog, /SQLITE_CANTOPEN/);
    assert.equal((failedLog.match(/DATABASE_OPEN_RETRY/g) ?? []).length, 2, 'Retries must be bounded');
    await unlock(); unlock = undefined;
    assert.equal(hash(await readFile(database)), before, 'Do not replace or reset an inaccessible database');
    backend = new Backend();
    await backend.start(options);
    assert.deepEqual(await backend.company(), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
  } finally {
    if (backend) await backend.stop();
    if (unlock) await unlock();
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('jbstock-db-access-'));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('a transient Windows file lock is retried on the same database without losing the saved profile', {
  timeout: 180000, skip: process.platform !== 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'jbstock-db-access-'));
  const database = join(root, 'data/jbstock.db');
  const logPath = join(root, 'logs/jbstock.log');
  const options = { java: resolve(__dirname, '../release/win-unpacked/resources/runtime/bin/java.exe'),
    jar: resolve(__dirname, '../../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar'), home: root };
  const profile = { name: 'Transient lock fixture', address: '', email: '', phone: '', fiscalIdentifiers: [] };
  let backend;
  let unlock;
  let startup;
  try {
    backend = new Backend();
    await backend.start(options);
    assert.deepEqual(await backend.saveCompany(profile), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
    unlock = await lockDatabase(database);
    backend = new Backend();
    // Capture rejection immediately, even while waiting for the first retry event.
    startup = backend.start(options).then(() => ({ ok: true }), error => ({ error }));
    let retryObserved = false;
    for (let i = 0; i < 1200; i++) {
      if ((await readFile(logPath, 'utf8')).includes('DATABASE_OPEN_RETRY')) { retryObserved = true; break; }
      await new Promise(done => setTimeout(done, 25));
    }
    assert.equal(retryObserved, true, 'Expected a recorded retry before releasing the fixture lock');
    await unlock(); unlock = undefined;
    const outcome = await startup;
    assert.equal(outcome.ok, true, outcome.error?.message);
    assert.deepEqual(await backend.company(), profile);
    assert.deepEqual(await backend.stop(), { forced: false });
    const log = await readFile(logPath, 'utf8');
    const retries = (log.match(/DATABASE_OPEN_RETRY/g) ?? []).length;
    assert.ok(retries >= 1 && retries <= 2);
    assert.match(log.trimEnd(), /LOGGING_STOPPED$/);
  } finally {
    if (unlock) await unlock();
    if (startup) await startup;
    if (backend) await backend.stop();
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('jbstock-db-access-'));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
