const { readFileSync, mkdirSync, writeFileSync, renameSync } = require('node:fs');
const { dirname } = require('node:path');
const messages = { en: require('./locales/en.json'), ar: require('./locales/ar.json') };

function validLanguage(value) { return value === 'en' || value === 'ar'; }

// Available before Java or the renderer starts, including when either fails.
class LanguagePreference {
  constructor(file) {
    this.file = file;
    this.language = 'en';
    this.readError = false;
    try {
      const value = JSON.parse(readFileSync(file, 'utf8')).language;
      if (!validLanguage(value)) throw new Error('INVALID_LANGUAGE');
      this.language = value;
    } catch (error) { this.readError = error.code !== 'ENOENT'; }
  }
  get() {
    if (this.readError) throw new Error('LANGUAGE_STORAGE_ERROR');
    return this.language;
  }
  set(value) {
    if (!validLanguage(value)) throw new Error('INVALID_LANGUAGE');
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file + '.tmp', JSON.stringify({ language: value }) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(this.file + '.tmp', this.file);
    this.language = value;
    this.readError = false;
    return value;
  }
}

function errorDialog(language, code) {
  const catalog = messages[validLanguage(language) ? language : 'en'];
  const knownCode = Object.hasOwn(catalog.desktop, code) ? code : 'STARTUP_ERROR';
  // Windows TaskDialog follows the OS paragraph direction. Embed Arabic text
  // explicitly so Latin product names do not reorder whole sentence fragments.
  const message = language === 'ar' ? '\u202b' + catalog.desktop[knownCode] + '\u202c' : catalog.desktop[knownCode];
  return { type: 'error', title: catalog.appName, message,
    buttons: [catalog.close], defaultId: 0, cancelId: 0, noLink: true };
}
module.exports = { LanguagePreference, errorDialog };
