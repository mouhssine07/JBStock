const { app, protocol, session } = require('electron');
const { join, resolve } = require('node:path');
const { writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { Backend } = require('../src/backend.cjs');
const { createShell } = require('../src/shell.cjs');
const { LanguagePreference, errorDialog } = require('../src/language.cjs');
const en = require('../src/locales/en.json');
const ar = require('../src/locales/ar.json');
const [home, phase] = process.argv.slice(2);
app.setPath('userData', join(home, 'electron'));
protocol.registerSchemesAsPrivileged([{ scheme: 'jbstock', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.on('window-all-closed', () => {});
let window;
const backend = new Backend();
const watchdog = setTimeout(() => finish(1), 80000);

app.whenReady().then(async () => {
  const languagePreference = new LanguagePreference(join(home, 'config/language.json'));
  assert.equal(languagePreference.language, phase === 'first' ? 'en' : 'ar');
  if (phase === 'restart') assert.equal(errorDialog(languagePreference.language, 'JAVA_RUNTIME_MISSING').message, '\u202b' + ar.desktop.JAVA_RUNTIME_MISSING + '\u202c');
  await backend.start({ java: process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java.exe') : 'java',
    jar: resolve('../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar'), home });
  // Deny Chromium HTTP(S) before first render. Java's private loopback IPC is unaffected.
  const localSession = session.fromPartition('jbstock-local');
  localSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  await assert.rejects(localSession.fetch('https://example.invalid'), /ERR_BLOCKED_BY_CLIENT/);
  window = await createShell(backend, resolve('../Jbstock-frontend/dist'), { show: false, languagePreference });
  await window.webContents.executeJavaScript(`window.testUI = {
    wait: async function(predicate) {
      for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 30)); }
      throw new Error('UI timeout');
    },
    input: function(selector, value) {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    language: async function(value) {
      const select = document.querySelector('select');
      select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
      await this.wait(() => document.documentElement.lang === value && !select.disabled);
    },
    check: function(condition, message) { if (!condition) throw new Error(message); }
  };
  testUI.wait(() => document.querySelector('input[name="name"]') && !document.querySelector('input[name="name"]').disabled);`);
  const catalogs = JSON.stringify({ en, ar });
  await window.webContents.executeJavaScript(`(async () => {
    const { wait, input, check } = testUI;
    const catalogs = ${catalogs};
    const first = ${phase === 'first'};
    const expected = first ? 'en' : 'ar';
    check(document.documentElement.lang === expected, 'startup language');
    check(document.documentElement.dir === (first ? 'ltr' : 'rtl'), 'startup direction');
    check(document.querySelector('h1').textContent === catalogs[expected].companyTitle, 'translated title');
    check(typeof require === 'undefined' && typeof process === 'undefined', 'renderer isolated');
    const denied = await window.jbstock.setLanguage('../ar');
    check(!denied.ok, 'invalid language rejected');
    const name = document.querySelector('input[name="name"]');
    if (!first) {
      check(name.value === 'متجر Demo 123', 'company persisted');
      check(document.querySelector('textarea').value === 'Casablanca الدار البيضاء', 'address persisted');
      check((await window.jbstock.getCompany()).data.fiscalIdentifiers[0].value === '001234', 'identifier preserved');
      await testUI.language('en');
      check(document.documentElement.dir === 'ltr', 'LTR restored');
      check(name.value === 'متجر Demo 123', 'data preserved on restart switch');
      return;
    }
    document.querySelector('form').requestSubmit();
    await wait(() => document.querySelector('form [role="alert"]')?.textContent === catalogs.en.nameRequired);
    await testUI.language('ar');
    check(document.querySelector('form [role="alert"]').textContent === catalogs.ar.nameRequired, 'validation retranslates');
    input('input[name="name"]', 'متجر Demo 123');
    input('textarea', 'Casablanca الدار البيضاء');
    input('input[name="phone"]', '+212 600 001234');
    input('input[name="email"]', 'invalid-email');
    await new Promise(r => setTimeout(r, 30));
    document.querySelector('form').requestSubmit();
    await wait(() => document.querySelector('form [role="alert"]')?.textContent === catalogs.ar.emailInvalid);
    input('input[name="email"]', 'demo@example.test');
    document.querySelector('section button').click();
    await wait(() => document.querySelectorAll('section input').length === 2);
    document.querySelector('form').requestSubmit();
    await wait(() => document.querySelector('form [role="alert"]')?.textContent === catalogs.ar.identifierRequired);
    input('section input', 'ICE معرّف');
    input('section label:nth-child(2) input', '001234');
    await testUI.language('en');
    check(name.value === 'متجر Demo 123', 'unsaved name preserved');
    check(document.querySelector('section input').value === 'ICE معرّف', 'unsaved label preserved');
    check(document.querySelector('form [role="alert"]').textContent === catalogs.en.identifierRequired, 'English validation');
    await testUI.language('ar');
    check(document.documentElement.dir === 'rtl', 'RTL applied');
    check(getComputedStyle(document.querySelector('header')).direction === 'rtl', 'RTL inherited');
    check(document.querySelector('input[name="phone"]').dir === 'ltr', 'phone remains LTR');
    check(document.querySelector('section button[aria-label]').getAttribute('aria-label') === catalogs.ar.removeIdentifier.replace('{number}', new Intl.NumberFormat('ar').format(1)), 'localized number');
    document.querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[role="status"]')?.textContent === catalogs.ar.saved);
    const saved = await window.jbstock.getCompany();
    check(saved.data.name === name.value && saved.data.fiscalIdentifiers[0].value === '001234', 'SQLite values unaltered');
  })()`);
  window.setContentSize(1100, 1100);
  window.webContents.invalidate();
  await window.webContents.executeJavaScript('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))');
  await new Promise(done => setTimeout(done, 200));
  writeFileSync(resolve('../Jbstock-backend/target', `desktop-i18n-${phase}.png`), (await window.webContents.capturePage()).toPNG());
  assert.deepEqual(await backend.stop(), { forced: false });
  // An actual backend failure must appear through a localized UI error.
  if (phase === 'restart') {
    await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('form').requestSubmit();
      await testUI.wait(() => document.querySelector('form [role="alert"]')?.textContent === ${JSON.stringify(en.saveError)});
      await testUI.language('ar');
      testUI.check(document.querySelector('form [role="alert"]').textContent === ${JSON.stringify(ar.saveError)}, 'backend error retranslates');
    })()`);
  }
  console.log('I18N_' + phase + '_OK');
}).then(() => finish(0), error => { console.error(error); finish(1); });

async function finish(code) {
  clearTimeout(watchdog);
  if (window && !window.isDestroyed()) window.destroy();
  await backend.stop();
  app.exit(code);
}
