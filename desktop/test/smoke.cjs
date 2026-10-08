const { app, protocol } = require('electron');
const { join, resolve, dirname, basename } = require('node:path');
const { mkdtemp, rm, writeFile, mkdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');
const { Backend } = require('../src/backend.cjs');
const { createShell } = require('../src/shell.cjs');
const { LanguagePreference } = require('../src/language.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'jbstock', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.on('window-all-closed', () => {});
let window;
let backend;
let home;
const watchdog = setTimeout(() => { console.error('ELECTRON_SMOKE_TIMEOUT'); app.exit(1); }, 100000);
app.whenReady().then(async () => {
  home = await mkdtemp(join(tmpdir(), 'jbstock-electron-'));
  backend = new Backend();
  await backend.start({ java: process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java.exe') : 'java',
    jar: resolve('../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar'), home });
  window = await createShell(backend, resolve('../Jbstock-frontend/dist'), {
    show: false, languagePreference: new LanguagePreference(join(home, 'config/language.json')) });
  const result = await window.webContents.executeJavaScript(`(async () => {
    const wait = async (predicate) => { for (let i=0; i<100; i++) { if(predicate()) return; await new Promise(r=>setTimeout(r,50)); } throw new Error('UI timeout'); };
    await wait(()=>document.querySelector('input') && !document.querySelector('input').disabled);
    if(typeof require !== 'undefined' || typeof process !== 'undefined') throw new Error('Node exposed');
    const input=document.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Electron UI demo');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('form').requestSubmit();
    await wait(()=>document.querySelector('[role="status"]'));
    const result=await window.jbstock.getCompany();
    const denied=await window.jbstock.saveCompany({name:'bad'});
    return {name:result.data.name, denied:denied.ok, keys:Object.keys(window.jbstock).sort(), title:document.title};
  })()`);
  assert.equal(result.name, 'Electron UI demo');
  assert.equal(result.denied, false);
  assert.deepEqual(result.keys, ['getCompany', 'getLanguage', 'saveCompany', 'setLanguage']);
  assert.equal(result.title, 'JBStock');
  const output = resolve('../Jbstock-backend/target');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'desktop-smoke.png'), (await window.webContents.capturePage()).toPNG());
  assert.deepEqual(await backend.stop(), { forced: false });
  console.log('ELECTRON_SMOKE_OK: React form, IPC, SQLite and graceful shutdown');
}).then(() => finish(0), (error) => { console.error('ELECTRON_SMOKE_FAILED', error.message); finish(1); });
async function finish(code) {
  clearTimeout(watchdog);
  if (window && !window.isDestroyed()) window.destroy();
  if (backend) await backend.stop();
  if (home) {
    assert.equal(dirname(resolve(home)), resolve(tmpdir()));
    assert.ok(basename(home).startsWith('jbstock-electron-'));
    await rm(home, { recursive: true, force: true });
  }
  app.exit(code);
}
