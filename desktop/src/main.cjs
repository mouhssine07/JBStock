const { app, protocol, dialog } = require('electron');
const { existsSync } = require('node:fs');
const { resolve, join, isAbsolute } = require('node:path');
const { Backend } = require('./backend.cjs');
const { createShell } = require('./shell.cjs');
const { LanguagePreference, errorDialog } = require('./language.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'jbstock', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (app.isPackaged && process.env.LOCALAPPDATA && isAbsolute(process.env.LOCALAPPDATA)) {
  app.setPath('userData', join(process.env.LOCALAPPDATA, 'JBStock', 'electron-profile'));
}
const backend = new Backend();
const languagePreference = new LanguagePreference(app.isPackaged
  ? join(app.getPath('userData'), 'settings', 'language.json')
  : resolve(__dirname, '../../Jbstock-backend/target/desktop-dev/config/language.json'));
let window;
let quitting = false;
let finished = false;
if (!app.requestSingleInstanceLock()) {
  console.error('JBSTOCK_SINGLE_INSTANCE_LOCK_UNAVAILABLE');
  app.exit(0);
}
else {
  app.on('second-instance', () => { if (window) { window.restore(); window.focus(); } });
  app.on('before-quit', event => {
    if (finished) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    backend.stop().finally(() => { finished = true; app.quit(); });
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(async () => {
    if (quitting) return;
    const root = resolve(__dirname, '../..');
    const resources = app.isPackaged ? process.resourcesPath : root;
    const java = app.isPackaged ? join(resources, 'runtime/bin/java.exe')
      : process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java.exe') : 'java';
    const jar = app.isPackaged ? join(resources, 'backend/jbstock.jar')
      : join(root, 'Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar');
    const frontend = app.isPackaged ? join(resources, 'frontend') : join(root, 'Jbstock-frontend/dist');
    if (app.isPackaged && !existsSync(java)) throw new Error('JAVA_RUNTIME_MISSING');
    if (app.isPackaged && !existsSync(jar)) throw new Error('BACKEND_PACKAGE_MISSING');
    if (app.isPackaged && !existsSync(join(frontend, 'index.html'))) throw new Error('FRONTEND_PACKAGE_MISSING');
    const home = app.isPackaged ? undefined
      : join(root, 'Jbstock-backend/target/desktop-dev');
    await backend.start({ java, jar, home });
    if (quitting) return;
    backend.on('unexpected-exit', () => {
      if (!quitting) {
        dialog.showMessageBoxSync(errorDialog(languagePreference.language, 'BACKEND_EXITED'));
        app.quit();
      }
    });
    window = await createShell(backend, frontend, { languagePreference });
  }).catch(error => {
    const messages = require('./locales/en.json').desktop;
    const knownCode = Object.hasOwn(messages, error.message) ? error.message : 'STARTUP_ERROR';
    console.error(`JBSTOCK_DESKTOP_STARTUP_FAILED ${knownCode}`);
    if (!quitting) dialog.showMessageBoxSync(errorDialog(languagePreference.language, knownCode));
    app.quit();
  });
}
