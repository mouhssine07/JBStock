const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, cp, mkdir, readFile, writeFile, rename, rm, stat } = require('node:fs/promises');
const { join, resolve, dirname, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { Backend } = require('../src/backend.cjs');

test('bundled Java persists local data across relocation with spaces and accents', {
  timeout: 180000, skip: process.platform !== 'win32',
}, async () => {
  const source = resolve(__dirname, '../release/win-unpacked/resources');
  // Fail explicitly when the package has not been built; do not silently use a system JDK.
  await stat(join(source, 'runtime/bin/java.exe'));
  await stat(join(source, 'backend/jbstock.jar'));
  const root = await mkdtemp(join(tmpdir(), 'jbstock-runtime-'));
  const originalEnv = { ...process.env };
  let backend;
  try {
    const installation = join(root, 'Installation été');
    const replacement = join(root, 'Installation déplacée');
    const localAppData = join(root, 'Profil été', 'Local');
    const home = join(localAppData, 'JBStock');
    await mkdir(installation, { recursive: true });
    await cp(join(source, 'runtime'), join(installation, 'runtime'), { recursive: true });
    await cp(join(source, 'backend'), join(installation, 'backend'), { recursive: true });

    // Scope the runner environment for its children; restore it in finally.
    // No user/system settings are modified.
    // A minimal environment also excludes inherited Spring/Java overrides.
    for (const key of Object.keys(process.env)) delete process.env[key];
    for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) {
      if (originalEnv[key]) process.env[key] = originalEnv[key];
    }
    process.env.PATH = join(originalEnv.SystemRoot, 'System32');
    process.env.LOCALAPPDATA = localAppData;
    const options = directory => ({ java: join(directory, 'runtime/bin/java.exe'),
      jar: join(directory, 'backend/jbstock.jar') });
    const profile = { name: 'Entreprise fictive été', address: 'Adresse de test',
      phone: '', email: 'demo@example.com',
      fiscalIdentifiers: [{ label: 'Identifiant fictif', value: 'DEMO-RESTART' }] };

    backend = new Backend();
    await backend.start(options(installation));
    assert.deepEqual(await backend.saveCompany(profile), profile);
    const marker = join(home, 'media/products/originals/temoin.txt');
    await writeFile(marker, 'Média fictif conservé', 'utf8');
    assert.deepEqual(await backend.stop(), { forced: false });
    await assert.rejects(() => backend.company(), /BACKEND_UNAVAILABLE/);
    const database = join(home, 'data/jbstock.db');
    assert.ok((await stat(database)).size > 0);
    assert.match(await readFile(join(home, 'logs/jbstock.log'), 'utf8'), /LOGGING_STOPPED/);

    // Relocation is a controlled check of installation/data separation, not an MSIX upgrade.
    await rename(installation, replacement);
    backend = new Backend();
    await backend.start(options(replacement));
    assert.deepEqual(await backend.company(), profile);
    assert.equal(await readFile(marker, 'utf8'), 'Média fictif conservé');
    assert.deepEqual(await backend.stop(), { forced: false });
    const log = await readFile(join(home, 'logs/jbstock.log'), 'utf8');
    assert.equal((log.match(/LOGGING_STOPPED/g) ?? []).length, 2);
    await assert.rejects(stat(join(replacement, 'data/jbstock.db')), { code: 'ENOENT' });
  } finally {
    try {
      if (backend) await backend.stop();
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, originalEnv);
      // Delete only the uniquely created test directory, never a supplied installation/profile.
      assert.equal(dirname(resolve(root)), resolve(tmpdir()));
      assert.ok(basename(root).startsWith('jbstock-runtime-'));
      await rm(root, { recursive: true, force: true });
    }
  }
});
