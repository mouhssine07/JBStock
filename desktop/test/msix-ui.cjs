// Explicit manual integration helper; requires an installed development MSIX
// launched with activate-msix-test.ps1. Never included in the application bundle.
const assert = require('node:assert/strict');
const { writeFile, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const [mode, portText = '9337', output = 'msix-ui', baseline] = process.argv.slice(2);
assert.ok(['seed', 'check', 'inspect'].includes(mode), 'Use seed, check or inspect');
const port = Number(portText);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const profile = { name: 'JBStock MSIX - entreprise fictive', address: 'Adresse fictive de validation',
  phone: '', email: 'msix-demo@example.com',
  fiscalIdentifiers: [{ label: 'TEST', value: 'MSIX-PERSISTENCE-001' }] };

async function main() {
  let page;
  for (let i = 0; i < 120; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })).json();
      page = targets.find(target => target.type === 'page' && target.url === 'jbstock://app/index.html');
      if (page) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(page, 'Installed JBStock page did not become ready');
  const endpoint = new URL(page.webSocketDebuggerUrl);
  assert.equal(endpoint.hostname, '127.0.0.1');
  assert.equal(Number(endpoint.port), port);
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timeout`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  try {
    const evaluated = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        const fixture = ${JSON.stringify(profile)};
        const wait = async predicate => {
          for (let i=0; i<100; i++) { if (predicate()) return; await new Promise(r=>setTimeout(r,100)); }
          throw new Error('UI timeout');
        };
        await wait(()=>document.querySelector('input') && !document.querySelector('input').disabled);
        if (typeof require !== 'undefined' || typeof process !== 'undefined') throw new Error('Node exposed');
        const before = await window.jbstock.getCompany();
        if (!before.ok) throw new Error('Company read failed');
        if (${JSON.stringify(mode)} === 'seed') {
          if (Object.entries(before.data).some(([key,value]) => key === 'fiscalIdentifiers' ? value.length : value !== '')) {
            throw new Error('Refusing to overwrite an existing company');
          }
          const fill = (selector, value) => {
            const field = document.querySelector(selector);
            const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field,value);
            field.dispatchEvent(new Event('input',{bubbles:true}));
          };
          fill('input[autocomplete="organization"]', fixture.name);
          fill('textarea', fixture.address);
          fill('input[type="email"]', fixture.email);
          document.querySelector('section button').click();
          await wait(()=>document.querySelectorAll('section input').length === 2);
          fill('section input', fixture.fiscalIdentifiers[0].label);
          fill('section label:nth-child(2) input', fixture.fiscalIdentifiers[0].value);
          document.querySelector('form').requestSubmit();
          await wait(()=>document.querySelector('[role="status"]'));
        }
        const after = await window.jbstock.getCompany();
        return { profile: after.data, ok: after.ok, displayedName: document.querySelector('input').value,
          bridgeKeys: Object.keys(window.jbstock).sort(), title: document.title };
      })()` });
    assert.equal(evaluated.exceptionDetails, undefined, JSON.stringify(evaluated.exceptionDetails));
    const result = evaluated.result.value;
    assert.equal(result.ok, true);
    const expected = baseline ? JSON.parse(await readFile(baseline, 'utf8')).profile : profile;
    if (mode !== 'inspect') assert.deepEqual(result.profile, expected);
    assert.equal(result.displayedName, result.profile.name);
    assert.deepEqual(result.bridgeKeys, result.bridgeKeys.includes('getLanguage')
      ? ['getCompany', 'getLanguage', 'saveCompany', 'setLanguage'] : ['getCompany', 'saveCompany']);
    assert.equal(result.title, 'JBStock');
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(output + '.png'), Buffer.from(capture.data, 'base64'));
    await writeFile(resolve(output + '.json'), JSON.stringify({ mode, ...result }, null, 2));
    console.log(`MSIX_UI_OK ${mode}: form, profile read${mode === 'inspect' ? '' : '/comparison'}, preload isolation`);
  } finally {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('CDP closed')); }
    socket.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
