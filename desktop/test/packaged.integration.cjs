const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer, connect } = require('node:net');
const { mkdtemp, cp, mkdir, readFile, writeFile, rename, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve, relative, dirname, basename, isAbsolute } = require('node:path');
const { createHash } = require('node:crypto');
const { extractFile } = require('@electron/asar');
const { DatabaseSync } = require('node:sqlite');

const desktop = resolve(__dirname, '..');
const source = join(desktop, 'release/win-unpacked');
const report = join(desktop, 'release/packaged-validation');
const delay = ms => new Promise(done => setTimeout(done, ms));
async function waitExit(run) {
  let timer;
  try { return await Promise.race([run.exit, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Packaged application did not exit gracefully')), 35000);
  })]); } finally { clearTimeout(timer); }
}
function within(root, path) {
  const rel = relative(resolve(root), resolve(path));
  assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel), 'Test path must stay within its isolated root');
}
async function freePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  return port;
}
async function closedPort(port) {
  await new Promise((done, reject) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); reject(new Error('Port remains open: ' + port)); });
    socket.once('error', done);
    socket.setTimeout(1500, () => { socket.destroy(); reject(new Error('Port closure unconfirmed')); });
  });
}
async function cdp(port) {
  let target;
  for (let i = 0; i < 180; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json();
      target = targets.find(item => item.url === 'jbstock://app/index.html');
      if (target) break;
    } catch {}
    await delay(250);
  }
  assert.ok(target, 'Packaged renderer not ready');
  const url = new URL(target.webSocketDebuggerUrl);
  assert.equal(url.hostname, '127.0.0.1');
  const socket = new WebSocket(url);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let next = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(message.id);
    message.error ? entry.reject(new Error(entry.method + ': ' + message.error.message)) : entry.done(message.result);
  });
  const client = {
    send(method, params = {}) {
      return new Promise((done, reject) => {
        const id = ++next;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 20000);
        pending.set(id, { done, reject, timer, method });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { for (const entry of pending.values()) clearTimeout(entry.timer); socket.close(); },
  };
  // The target URL can be published before Chromium replaces about:blank.
  // Wait on the final document before executing any mutating UI scenario.
  for (let i = 0; i < 100; i++) {
    try {
      const ready = await client.send('Runtime.evaluate', { returnByValue: true,
        expression: "location.href === 'jbstock://app/index.html' && document.readyState === 'complete' && !!window.jbstock" });
      if (ready.result.value === true) return client;
    } catch (error) { if (!error.message.includes('Execution context was destroyed')) { client.close(); throw error; } }
    await delay(50);
  }
  client.close();
  throw new Error('Packaged document did not finish loading');
}

async function inspectProcesses(mode, installation, parentProcessId = 0) {
  return new Promise((done, reject) => {
    const helper = spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), [
      '-NoProfile', '-File', join(__dirname, 'packaged-processes.ps1'), '-Mode', mode,
      '-InstallationDirectory', installation, '-ParentProcessId', String(parentProcessId),
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let errors = '';
    helper.stdout.on('data', data => { output += data; }); helper.stderr.on('data', data => { errors += data; });
    helper.once('error', reject);
    helper.once('exit', code => {
      if (code !== 0) { reject(new Error(errors)); return; }
      try { done(JSON.parse(output.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); }
    });
  });
}

async function inspectWindow(mode, processId, expectedHandle = 0) {
  return new Promise((done, reject) => {
    const helper = spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), [
      '-NoProfile', '-File', join(__dirname, 'packaged-window.ps1'), '-Mode', mode,
      '-ProcessId', String(processId), '-ExpectedHandle', String(expectedHandle),
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let errors = '';
    helper.stdout.on('data', data => { output += data; }); helper.stderr.on('data', data => { errors += data; });
    helper.once('error', reject);
    helper.once('exit', code => {
      if (code !== 0) { reject(new Error(errors)); return; }
      try { done(JSON.parse(output.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); }
    });
  });
}

async function verifyNativeDialog(run, language, code) {
  await new Promise((done, reject) => {
    const helper = spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), [
      '-NoProfile', '-File', join(__dirname, 'native-dialog.ps1'), '-ProcessId', String(run.child.pid),
      '-Language', language, '-Code', code, '-OutputPath', join(report, `${code}-${language}`),
    ], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    let output = '';
    helper.stdout.on('data', data => { output += data; }); helper.stderr.on('data', data => { output += data; });
    helper.once('error', reject); helper.once('exit', exitCode => exitCode === 0 ? done() : reject(new Error(output + '\n' + run.output())));
  });
}

test('packaged lifecycle, single instance, parent/Java crash recovery and eight native dialogs', { timeout: 300000, skip: process.platform !== 'win32' }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'jbstock-packaged-'));
  const installation = join(root, 'Installation été');
  const local = join(root, 'Profil été/Local');
  const home = join(local, 'JBStock');
  const preference = join(home, 'electron-profile/settings/language.json');
  let active;
  let secondary;
  let completed = false;
  const startedAt = new Date().toISOString();
  try {
    await mkdir(report, { recursive: true });
    await writeFile(join(report, 'summary.json'), JSON.stringify({ status: 'running', startedAt }));
    // Refuse stale desktop sources/catalogs even if an old executable still starts.
    const archive = join(source, 'resources/app.asar');
    for (const file of ['main.cjs', 'backend.cjs', 'shell.cjs', 'preload.cjs', 'language.cjs', 'locales/en.json', 'locales/ar.json']) {
      assert.deepEqual(extractFile(archive, join('src', file)), await readFile(join(desktop, 'src', file)), 'Stale packaged source: ' + file);
    }
    assert.deepEqual(await readFile(join(source, 'resources/frontend/index.html')), await readFile(join(desktop, '../Jbstock-frontend/dist/index.html')));
    assert.deepEqual(await readFile(join(source, 'resources/backend/jbstock.jar')), await readFile(join(desktop, '../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar')));
    await cp(source, installation, { recursive: true });
    const env = {};
    for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { PATH: join(process.env.SystemRoot, 'System32'), LOCALAPPDATA: local,
      APPDATA: join(root, 'Roaming'), USERPROFILE: join(root, 'User') });
    for (const path of [local, env.APPDATA, env.USERPROFILE]) await mkdir(path, { recursive: true });
    function launch(args = [], nativeDialog = false, primary = true, visible = false) {
      const child = spawn(join(installation, 'JBStock.exe'), args, { env, cwd: installation, windowsHide: !(nativeDialog || visible), stdio: ['ignore', 'pipe', 'pipe'] });
      if (primary) active = child;
      else secondary = child;
      let output = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      const exit = new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); });
      return { child, exit, output: () => output };
    }
    async function rejectSecondLaunch() {
      const secondaryPort = await freePort();
      const second = launch([`--remote-debugging-port=${secondaryPort}`, '--remote-debugging-address=127.0.0.1'], false, false);
      assert.equal(await waitExit(second), 0, second.output());
      secondary = null;
      assert.ok(second.output().includes('JBSTOCK_SINGLE_INSTANCE_LOCK_UNAVAILABLE'), 'Second launch must refuse the shared-profile lock');
      await closedPort(secondaryPort);
    }
    const profile = { name: 'Packaged متجر été', address: 'Adresse fictive', phone: '+212 600 001234', email: 'demo@example.test', fiscalIdentifiers: [] };
    const phases = ['first', 'restart', 'parent-crash', 'recovery'];
    for (const [index, phase] of phases.entries()) {
      const port = await freePort();
      const run = launch([`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], false, true, phase === 'first');
      if (phase === 'first') {
        let startupLog = '';
        for (let i = 0; i < 180; i++) {
          try { startupLog = await readFile(join(home, 'logs/jbstock.log'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          if (startupLog.includes('LOGGING_READY')) break;
          await delay(100);
        }
        assert.match(startupLog, /LOGGING_READY/);
        assert.ok(!startupLog.includes('BACKEND_READY'), 'Startup second-launch fixture must run before backend readiness');
        await rejectSecondLaunch();
      }
      const client = await cdp(port);
      let processes;
      try {
        const result = await client.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
          const wait = async fn => { for(let i=0;i<150;i++){ if(fn())return; await new Promise(r=>setTimeout(r,30)); } throw Error('UI timeout'); };
          await wait(()=>document.querySelector('input') && !document.querySelector('input').disabled);
          const first = ${phase === 'first'};
          if(document.documentElement.lang !== (first ? 'en' : 'ar')) throw Error('Language not restored');
          if(document.documentElement.dir !== (first ? 'ltr' : 'rtl')) throw Error('Wrong direction');
          if(typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Node exposed');
          if(first) {
            const fixture = ${JSON.stringify(profile)};
            for(const [key,value] of Object.entries(fixture)) {
              if(key==='fiscalIdentifiers') continue;
              const field = document.querySelector('[name="'+key+'"]');
              Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(field,value);
              field.dispatchEvent(new Event('input',{bubbles:true}));
            }
            await new Promise(r=>setTimeout(r,30));
            const select = document.querySelector('select'); select.value='ar'; select.dispatchEvent(new Event('change',{bubbles:true}));
            await wait(()=>document.documentElement.lang==='ar' && !select.disabled);
            document.querySelector('form').requestSubmit();
            await wait(()=>document.querySelector('[role="status"]'));
          }
          return {profile:(await window.jbstock.getCompany()).data,language:document.documentElement.lang,dir:document.documentElement.dir};
        })()` });
        assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
        assert.deepEqual(result.result.value, { profile, language: 'ar', dir: 'rtl' });
        assert.equal(JSON.parse(await readFile(preference, 'utf8')).language, 'ar');
        processes = await inspectProcesses('running', installation, run.child.pid);
        const health = await (await fetch(`http://127.0.0.1:${processes.backendPort}/health`, { signal: AbortSignal.timeout(3000) })).json();
        assert.equal(health.status, 'UP');
        if (phase === 'first') {
          const trace = [];
          async function recordLanguage(stage) {
            const snapshot = await client.send('Runtime.evaluate', { returnByValue:true, expression:`({
              language:document.documentElement.lang, dir:document.documentElement.dir,
              selected:document.querySelector('select').value, events:window.__languageTestEvents ?? []
            })` });
            trace.push({ stage, ...snapshot.result.value, persisted:JSON.parse(await readFile(preference, 'utf8')).language });
            await writeFile(join(report, 'single-instance-language-trace.json'), JSON.stringify(trace, null, 2));
          }
          await client.send('Runtime.evaluate', { expression:`window.__languageTestEvents=[];
            document.addEventListener('change', event => { if(event.target.name==='language')
              window.__languageTestEvents.push({value:event.target.value,trusted:event.isTrusted}); }, true);` });
          await recordLanguage('before-draft');
          const draft = 'Unsaved mono-instance brouillon متجر';
          const edit = await client.send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
            const field = document.querySelector('[name="name"]');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(draft)});
            field.dispatchEvent(new Event('input', {bubbles:true}));
            return field.value;
          })()` });
          assert.equal(edit.result.value, draft);
          await recordLanguage('after-draft');
          const minimized = await inspectWindow('minimize', run.child.pid);
          await recordLanguage('after-minimize');
          await rejectSecondLaunch();
          await recordLanguage('after-secondary');
          const restored = await inspectWindow('restored', run.child.pid, minimized.windowHandle);
          const after = await inspectProcesses('running', installation, run.child.pid);
          assert.equal(after.javaProcessId, processes.javaProcessId, 'Second launch must retain the original Java process');
          assert.equal(after.backendPort, processes.backendPort, 'Second launch must retain the original backend port');
          const state = await client.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => ({
            draft:document.querySelector('[name="name"]').value, language:document.documentElement.lang,
            dir:document.documentElement.dir, profile:(await window.jbstock.getCompany()).data
          }))()` });
          assert.equal(state.exceptionDetails, undefined);
          assert.deepEqual(state.result.value, { draft, language:'ar', dir:'rtl', profile });
          const log = await readFile(join(home, 'logs/jbstock.log'), 'utf8');
          assert.equal((log.match(/LOGGING_READY/g) ?? []).length, 1, 'No second Java startup in the shared profile');
          await writeFile(join(report, 'single-instance.json'), JSON.stringify({ status:'passed', startedAt,
            duringBackendStartup:true, minimizedWindowRestored:true, sameWindow:restored.windowHandle === minimized.windowHandle,
            foreground:restored.foreground, visibleWindows:restored.visibleWindows,
            sameJavaProcess:true, sameBackendPort:true, draftPreserved:true, savedDataPreserved:true,
            languagePreserved:true, secondaryLaunchesExited:2, secondaryDiagnosticPortsClosed:true }, null, 2));
        }
        await delay(200);
        const shot = await client.send('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(report, `packaged-${phase}.png`), Buffer.from(shot.data, 'base64'));
        if (phase === 'parent-crash') {
          // Deliberately terminate only this test's Electron main. Never kill Java:
          // its private stdin pipe must close and trigger Spring's graceful shutdown.
          assert.equal(run.child.kill('SIGKILL'), true);
        } else await client.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 100)' });
      } finally { client.close(); }
      const exitCode = await waitExit(run); active = null;
      if (phase !== 'parent-crash') assert.equal(exitCode, 0, run.output());
      assert.deepEqual(await inspectProcesses('stopped', installation), { processesExited: true });
      await closedPort(port);
      await closedPort(processes.backendPort);
      const log = await readFile(join(home, 'logs/jbstock.log'), 'utf8');
      assert.match(log.trimEnd(), /LOGGING_STOPPED$/);
      assert.equal((log.match(/LOGGING_STOPPED/g) ?? []).length, index + 1);
      await writeFile(join(report, `lifecycle-${phase}.json`), JSON.stringify({ phase, ...processes,
        processesExited: true, backendPortClosed: true, diagnosticPortClosed: true, backendShutdownLogged: true }, null, 2));
    }
    const db = join(home, 'data/jbstock.db');
    const dbHash = createHash('sha256').update(await readFile(db)).digest('hex');
    const scenarios = { JAVA_RUNTIME_MISSING: 'runtime/bin/java.exe', BACKEND_PACKAGE_MISSING: 'backend/jbstock.jar', FRONTEND_PACKAGE_MISSING: 'frontend/index.html' };
    for (const [code, resource] of Object.entries(scenarios)) {
      const path = join(installation, 'resources', resource);
      const hidden = path + '.test-missing';
      within(root, path); within(root, hidden);
      await rename(path, hidden);
      try {
        for (const language of ['en', 'ar']) {
          await writeFile(preference, JSON.stringify({ language }));
          const run = launch([], true);
          await verifyNativeDialog(run, language, code);
          assert.equal(await waitExit(run), 0); active = null;
          assert.ok(run.output().includes('JBSTOCK_DESKTOP_STARTUP_FAILED ' + code));
          assert.equal(createHash('sha256').update(await readFile(db)).digest('hex'), dbHash, 'Missing resource must not alter database');
        }
      } finally { within(root, hidden); within(root, path); await rename(hidden, path); }
    }
    for (const language of ['en', 'ar']) {
      await writeFile(preference, JSON.stringify({ language }));
      const logPath = join(home, 'logs/jbstock.log');
      const stopsBefore = ((await readFile(logPath, 'utf8')).match(/LOGGING_STOPPED/g) ?? []).length;
      const crashes = [];
      for (const phase of ['java-crash', 'java-recovery']) {
        const port = await freePort();
        const run = launch([`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], true);
        const client = await cdp(port);
        let processes;
        try {
          const state = await client.send('Runtime.evaluate', { awaitPromise:true, returnByValue:true, expression:`(async () => {
            for(let i=0;i<150;i++) {
              if(document.querySelector('[name="name"]') && !document.querySelector('[name="name"]').disabled) break;
              await new Promise(r=>setTimeout(r,30));
            }
            return { profile:(await window.jbstock.getCompany()).data, language:document.documentElement.lang,
              dir:document.documentElement.dir, displayedName:document.querySelector('[name="name"]').value };
          })()` });
          assert.equal(state.exceptionDetails, undefined, JSON.stringify(state.exceptionDetails));
          assert.deepEqual(state.result.value, { profile, language, dir:language === 'ar' ? 'rtl':'ltr', displayedName:profile.name });
          processes = await inspectProcesses('running', installation, run.child.pid);
          if (phase === 'java-crash') {
            const terminated = await inspectProcesses('terminate-java', installation, run.child.pid);
            assert.equal(terminated.terminatedJavaProcessId, processes.javaProcessId);
            await closedPort(processes.backendPort);
            assert.deepEqual(await inspectProcesses('no-java', installation, run.child.pid), { noJavaProcess:true, mainStillRunning:true });
            await verifyNativeDialog(run, language, 'BACKEND_EXITED');
          } else await client.send('Runtime.evaluate', { expression:'setTimeout(() => window.close(), 100)' });
        } finally { client.close(); }
        assert.equal(await waitExit(run), 0, run.output()); active = null;
        assert.deepEqual(await inspectProcesses('stopped', installation), { processesExited:true });
        await closedPort(port); await closedPort(processes.backendPort);
        const stops = ((await readFile(logPath, 'utf8')).match(/LOGGING_STOPPED/g) ?? []).length;
        assert.equal(stops, stopsBefore + (phase === 'java-recovery' ? 1:0), 'Killed Java cannot log a graceful stop; recovered Java must do so');
        crashes.push({ phase, ...processes, processesExited:true, portsClosed:true, savedDataPreserved:true, languagePreserved:true });
      }
      const database = new DatabaseSync(db, { readOnly:true });
      try {
        assert.deepEqual(database.prepare('PRAGMA quick_check').all().map(row => row.quick_check), ['ok']);
        assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
      } finally { database.close(); }
      assert.equal(JSON.parse(await readFile(preference, 'utf8')).language, language);
      await writeFile(join(report, `java-crash-${language}.json`), JSON.stringify({ status:'passed', language,
        alertMatched:true, noAutomaticJavaRestartWhileAlert:true, integrity:'ok', foreignKeys:'ok', cycles:crashes }, null, 2));
    }
    await writeFile(join(report, 'summary.json'), JSON.stringify({ status: 'passed', startedAt, packagedStarts: 8, persistedLanguage: 'ar', bundledJava: true,
      isolatedPathsWithAccents: true, gracefulBackendShutdowns: 6, parentCrashRecovery: true, noResidualProcessesOrPorts: true,
      nativeDialogs: 8, missingResourceDialogs: 6, backendExitDialogs: 2, forcedJavaTerminations: 2,
      javaCrashRecovery:true, databaseIntegrityAfterJavaCrash:true, databasePreservedOnFailure: true,
      singleInstance: true, secondaryLaunches: 2, minimizedWindowRestored: true, draftPreserved: true,
      windowsCleanMachine: false, systemNetworkDisconnected: false }, null, 2));
    completed = true;
  } finally {
    if (!completed) await writeFile(join(report, 'summary.json'), JSON.stringify({ status: 'failed', startedAt }));
    if (secondary && secondary.exitCode === null) secondary.kill();
    if (active && active.exitCode === null) {
      active.kill(); // Only this test's direct child. Java receives EOF if it was running.
      await delay(3000);
    }
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('jbstock-packaged-'));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
