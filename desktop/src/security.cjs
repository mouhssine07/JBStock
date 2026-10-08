const { resolve, relative, isAbsolute } = require('node:path');
const APP_URL = 'jbstock://app/index.html';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";

function assetPath(url, root) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'jbstock:' || parsed.host !== 'app' || parsed.username || parsed.password) throw new Error('INVALID_ASSET');
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('INVALID_ASSET');
  const path = resolve(root, '.' + pathname);
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('INVALID_ASSET');
  return path;
}

function assertSender(event, window) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents
      || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== APP_URL) {
    throw new Error('FORBIDDEN_SENDER');
  }
}

function validateCompany(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_COMPANY');
  const lengths = { name: 255, address: 2000, phone: 50, email: 254 };
  for (const [key, length] of Object.entries(lengths)) {
    if (typeof value[key] !== 'string' || value[key].length > length) throw new Error('INVALID_COMPANY');
  }
  if (!value.name.trim() || !Array.isArray(value.fiscalIdentifiers) || value.fiscalIdentifiers.length > 20) throw new Error('INVALID_COMPANY');
  for (const entry of value.fiscalIdentifiers) {
    if (!entry || typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > 100
        || typeof entry.value !== 'string' || entry.value.length > 255) throw new Error('INVALID_COMPANY');
  }
  return { name: value.name, address: value.address, phone: value.phone, email: value.email,
    fiscalIdentifiers: value.fiscalIdentifiers.map(({ label, value }) => ({ label, value })) };
}
module.exports = { APP_URL, CSP, assetPath, assertSender, validateCompany };
