const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname, resolve, basename } = require('node:path');
const { LanguagePreference, errorDialog } = require('../src/language.cjs');
const en = require('../src/locales/en.json');
const ar = require('../src/locales/ar.json');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'jbstock-language-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('jbstock-language-'));
    rmSync(root, { recursive: true, force: true });
  });
  return join(root, 'config/language.json');
}

test('language defaults to English and survives fresh preference instances', t => {
  const file = fixture(t);
  const preference = new LanguagePreference(file);
  assert.equal(preference.get(), 'en');
  preference.set('ar');
  assert.equal(new LanguagePreference(file).get(), 'ar');
  preference.set('en');
  assert.equal(new LanguagePreference(file).get(), 'en');
  for (const value of ['fr', '../ar', null, {}, ['ar'], '__proto__']) {
    assert.throws(() => preference.set(value));
    assert.equal(new LanguagePreference(file).get(), 'en');
  }
});

test('malformed preferences fall back without overwriting the file', t => {
  const file = fixture(t);
  mkdirSync(dirname(file), { recursive: true });
  for (const content of ['{broken', '{"language":"fr"}', 'null']) {
    writeFileSync(file, content);
    const preference = new LanguagePreference(file);
    assert.equal(preference.language, 'en');
    assert.throws(() => preference.get());
    assert.equal(readFileSync(file, 'utf8'), content);
    preference.set('ar');
    assert.equal(preference.get(), 'ar');
  }
});

test('failed writes keep the last persisted language', t => {
  const file = fixture(t);
  const preference = new LanguagePreference(file);
  preference.set('ar');
  mkdirSync(file + '.tmp');
  assert.throws(() => preference.set('en'));
  assert.equal(preference.get(), 'ar');
  assert.equal(new LanguagePreference(file).get(), 'ar');
});

test('catalog keys and placeholders match; desktop errors and buttons are localized', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  assert.deepEqual(Object.keys(en.desktop).sort(), Object.keys(ar.desktop).sort());
  for (const key of Object.keys(en).filter(key => key !== 'desktop')) {
    assert.ok(ar[key].trim());
    assert.deepEqual(en[key].match(/\{\w+\}/g), ar[key].match(/\{\w+\}/g));
  }
  for (const language of ['en', 'ar']) {
    const catalog = language === 'ar' ? ar : en;
    for (const code of Object.keys(en.desktop)) {
      const options = errorDialog(language, code);
      assert.equal(options.message, language === 'ar' ? '\u202b' + catalog.desktop[code] + '\u202c' : catalog.desktop[code]);
      assert.deepEqual(options.buttons, [catalog.close]);
    }
    assert.equal(errorDialog(language, 'secret unexpected error').message,
      language === 'ar' ? '\u202b' + catalog.desktop.STARTUP_ERROR + '\u202c' : catalog.desktop.STARTUP_ERROR);
  }
});
