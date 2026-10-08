const { BrowserWindow, ipcMain, session, net } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { APP_URL, CSP, assetPath, assertSender, validateCompany } = require('./security.cjs');

async function createShell(backend, frontend, { show = true, languagePreference } = {}) {
  const ses = session.fromPartition('jbstock-local');
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on('will-download', event => event.preventDefault());
  await ses.protocol.handle('jbstock', async request => {
    try {
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      const response = await net.fetch(pathToFileURL(assetPath(request.url, frontend)).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', CSP);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, headers });
    } catch { return new Response(null, { status: 404 }); }
  });
  const window = new BrowserWindow({ width: 1100, height: 820, minWidth: 720, minHeight: 560,
    title: 'JBStock', show: false, backgroundColor: '#f8fafc',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), session: ses,
      backgroundThrottling: show,
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false } });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  for (const [channel, action] of [
    ['company:get', () => backend.company()],
    ['company:save', value => backend.saveCompany(validateCompany(value))],
  ]) {
    ipcMain.handle(channel, async (event, value) => {
      assertSender(event, window);
      try { return { ok: true, data: await action(value) }; }
      catch (error) { return { ok: false, code: error.message === 'INVALID_COMPANY' ? 'INVALID_COMPANY' : 'BACKEND_UNAVAILABLE' }; }
    });
  }
  for (const [channel, action] of [
    ['language:get', () => languagePreference.get()],
    ['language:set', value => languagePreference.set(value)],
  ]) {
    ipcMain.handle(channel, async (event, value) => {
      assertSender(event, window);
      try { return { ok: true, data: action(value) }; }
      catch { return { ok: false, code: 'LANGUAGE_STORAGE_ERROR' }; }
    });
  }
  window.on('closed', () => {
    ipcMain.removeHandler('company:get');
    ipcMain.removeHandler('company:save');
    ipcMain.removeHandler('language:get');
    ipcMain.removeHandler('language:set');
    ses.protocol.unhandle('jbstock');
  });
  await window.loadURL(APP_URL);
  if (show) window.show();
  return window;
}
module.exports = { createShell };
