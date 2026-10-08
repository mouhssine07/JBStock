const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, mkdir, readFile, writeFile, readdir, stat, rm, copyFile } = require('node:fs/promises');
const { resolve, join, dirname, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { createServer } = require('node:net');
const { createHash } = require('node:crypto');
const { extractFile } = require('@electron/asar');
const { DatabaseSync } = require('node:sqlite');

const desktop = resolve(__dirname, '..');
const build = join(desktop, 'release/nsis-lifecycle');
const report = join(build, 'validation.json');
const executable = 'JBStockLifecycleTest.exe';
const delay = ms => new Promise(done => setTimeout(done, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function run(path, args, env, rawArgs = false) {
  const child = spawn(path, args, { env, windowsHide: true, windowsVerbatimArguments: rawArgs,
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const exit = new Promise((done, reject) => {
    child.once('error', reject); child.once('exit', done);
  });
  return { child, exit, output: () => output };
}
async function exited(process, timeout = 120000) {
  let timer;
  try {
    return await Promise.race([process.exit, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Test process exit timeout')), timeout);
    })]);
  } finally { clearTimeout(timer); }
}
async function processes(mode, installation, parent = 0) {
  const helper = run(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-File', join(__dirname, 'packaged-processes.ps1'), '-Mode', mode,
      '-InstallationDirectory', installation, '-ParentProcessId', String(parent)], process.env);
  assert.equal(await exited(helper), 0, helper.output());
  return JSON.parse(helper.output().replace(/^\uFEFF/, ''));
}
async function freePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  return port;
}
async function renderer(port) {
  let target;
  for (let i = 0; i < 240; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`,
        { signal: AbortSignal.timeout(1000) })).json();
      target = targets.find(item => item.url === 'jbstock://app/index.html');
      if (target) break;
    } catch {}
    await delay(250);
  }
  assert.ok(target, 'Installed renderer not ready');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let next = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(message.id);
    message.error ? entry.reject(new Error(message.error.message)) : entry.done(message.result);
  });
  return {
    async evaluate(expression) {
      const result = await new Promise((done, reject) => {
        const id = ++next;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Renderer timeout')); }, 20000);
        pending.set(id, { done, reject, timer });
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true } }));
      });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    },
    close() { for (const entry of pending.values()) clearTimeout(entry.timer); socket.close(); },
  };
}

test('isolated NSIS install, uninstall and reinstall preserve company, language and media', {
  timeout: 420000, skip: process.platform !== 'win32',
}, async () => {
  // Only the distinct test product/identity may be installed or uninstalled here.
  const installer = join(build, 'JBStockLifecycleTest-0.0.1-setup.exe');
  await stat(installer);
  await stat(join(build, 'win-unpacked', executable));
  const root = await mkdtemp(join(tmpdir(), 'jbstock-nsis-'));
  const installation = join(root, 'Installation été');
  const local = join(root, 'Profil été/Local');
  const home = join(local, 'JBStock');
  const database = join(home, 'data/jbstock.db');
  const preference = join(home, 'electron-profile/settings/language.json');
  const media = join(home, 'media/products/originals/sentinel.txt');
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { PATH: join(process.env.SystemRoot, 'System32'), LOCALAPPDATA: local,
    APPDATA: join(root, 'Roaming'), USERPROFILE: join(root, 'User') });
  for (const path of [local, env.APPDATA, env.USERPROFILE]) await mkdir(path, { recursive: true });
  const profile = { name: 'Reinstall متجر été', address: 'Fictional address', phone: '', email: '', fiscalIdentifiers: [] };
  const result = { status: 'running', isolatedIdentity: 'com.jbstock.validation.lifecycle', root, starts: [] };
  let active;
  let installed = false;
  let passed = false;
  let uninstall;
  try {
    await writeFile(report, JSON.stringify(result, null, 2));
    async function install() {
      // NSIS requires /D to be last and unquoted, even when it contains spaces.
      const setup = run(installer, ['/S', `/D=${installation}`], env, true);
      assert.equal(await exited(setup), 0, setup.output());
      installed = true;
      await stat(join(installation, executable));
      uninstall = (await readdir(installation)).find(name => /^Uninstall .*\.exe$/i.test(name));
      assert.ok(uninstall, 'Expected the test product uninstaller');
      const archive = join(installation, 'resources/app.asar');
      for (const file of ['main.cjs', 'backend.cjs', 'shell.cjs', 'preload.cjs', 'language.cjs', 'locales/en.json', 'locales/ar.json']) {
        assert.deepEqual(extractFile(archive, join('src', file)), await readFile(join(desktop, 'src', file)), 'Stale installed source: ' + file);
      }
    }
    async function removeInstallation(running = false) {
      if (!running) await processes('stopped', installation);
      // Match NSIS's normal relocation outside INSTDIR. With _?=, an in-place
      // uninstaller would kill itself when the template closes running app processes.
      const relocated = join(root, 'test-uninstaller.exe');
      await copyFile(join(installation, uninstall), relocated);
      const removal = run(relocated, ['/S', `_?=${installation}`], env, true);
      assert.equal(await exited(removal), 0, removal.output());
      if (running && active) { await exited(active, 35000); active = undefined; }
      await assert.rejects(stat(join(installation, executable)), { code: 'ENOENT' });
      installed = false;
    }
    async function lifecycle(phase, seed = false, leaveRunning = false) {
      const port = await freePort();
      const started = performance.now();
      active = run(join(installation, executable), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], env);
      let client;
      try {
        client = await renderer(port);
        // Chromium publishes the target before replacing about:blank. Do not mutate until ready.
        let ready = false;
        for (let i = 0; i < 150; i++) {
          try {
            ready = await client.evaluate("location.href==='jbstock://app/index.html' && document.readyState==='complete' && !!window.jbstock && !!document.querySelector('input') && !document.querySelector('input').disabled");
            if (ready) break;
          } catch (error) { if (!error.message.includes('Execution context was destroyed')) throw error; }
          await delay(50);
        }
        assert.equal(ready, true, 'Installed document not ready');
        const uiReadyMs = Math.round(performance.now() - started);
        const actual = await client.evaluate(`(async () => {
          for(let i=0;i<150;i++) {
            if(window.jbstock && document.querySelector('input') && !document.querySelector('input').disabled) break;
            await new Promise(r=>setTimeout(r,30));
          }
          if(${seed}) {
            if(document.documentElement.lang!=='en') throw Error('Expected initial English');
            const saved=await window.jbstock.saveCompany(${JSON.stringify(profile)});
            if(!saved.ok) throw Error('Save failed');
            await window.jbstock.setLanguage('ar');
          }
          return {company:(await window.jbstock.getCompany()).data,language:(await window.jbstock.getLanguage()).data};
        })()`);
        assert.deepEqual(actual, { company: profile, language: 'ar' });
        const owned = await processes('running', installation, active.child.pid);
        result.starts.push({ phase, uiReadyMs, backendPort: owned.backendPort });
        if (leaveRunning) return;
        await client.evaluate('setTimeout(() => window.close(), 100)');
        assert.equal(await exited(active, 35000), 0, active.output());
        active = undefined;
        await processes('stopped', installation);
        const log = await readFile(join(home, 'logs/jbstock.log'), 'utf8');
        assert.match(log.trimEnd(), /LOGGING_STOPPED$/);
      } finally { if (client) client.close(); }
    }
    await install();
    await lifecycle('initial', true);
    await writeFile(media, 'Fictional preserved media');
    const hashes = { database: hash(await readFile(database)), preference: hash(await readFile(preference)), media: hash(await readFile(media)) };
    await removeInstallation();
    for (const [key, path] of Object.entries({ database, preference, media })) assert.equal(hash(await readFile(path)), hashes[key], key + ' changed on uninstall');
    result.preservedOnUninstall = true;
    await install();
    for (const [key, path] of Object.entries({ database, preference, media })) assert.equal(hash(await readFile(path)), hashes[key], key + ' changed on reinstall');
    await lifecycle('reinstalled');
    assert.equal(await readFile(media, 'utf8'), 'Fictional preserved media');
    const db = new DatabaseSync(database, { readOnly: true });
    try {
      assert.deepEqual(db.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']);
      assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    } finally { db.close(); }
    result.integrity = 'ok'; result.status = 'passed';
    // Also exercise the case where the user uninstalls while the application is open.
    await lifecycle('open-before-uninstall', false, true);
    await removeInstallation(true);
    await stat(database); await stat(preference); await stat(media);
    await install();
    await lifecycle('reinstalled-after-running-uninstall');
    const recovered = new DatabaseSync(database, { readOnly: true });
    try { assert.deepEqual(recovered.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']); }
    finally { recovered.close(); }
    assert.equal(await readFile(media, 'utf8'), 'Fictional preserved media');
    result.uninstallWhileRunning = true;
    passed = true;
  } finally {
    if (active && active.child.exitCode === null) {
      active.child.kill(); // Only the distinct test product's direct main; Java gets EOF.
      await exited(active, 35000);
      active = undefined;
    }
    if (installed && uninstall) {
      await processes('stopped', installation);
      const relocated = join(root, 'test-uninstaller.exe');
      await copyFile(join(installation, uninstall), relocated);
      const removal = run(relocated, ['/S', `_?=${installation}`], env, true);
      assert.equal(await exited(removal), 0, removal.output());
      installed = false;
    }
    result.status = passed ? 'passed' : 'failed';
    result.testInstallationRemoved = !installed;
    await writeFile(report, JSON.stringify(result, null, 2));
    // Keep the isolated fixture for inspection on failure. Never delete a supplied profile.
    if (passed) {
      assert.equal(dirname(resolve(root)), resolve(tmpdir()));
      assert.ok(basename(root).startsWith('jbstock-nsis-'));
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
});
