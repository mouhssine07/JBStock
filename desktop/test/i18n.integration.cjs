const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');

test('English/Arabic UI and offline language persistence across two Electron processes', { timeout: 180000 }, async () => {
  const home = mkdtempSync(join(tmpdir(), 'jbstock-i18n-'));
  try {
    for (const phase of ['first', 'restart']) {
      await new Promise((done, reject) => {
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(require('electron'), [join(__dirname, 'i18n-smoke.cjs'), home, phase], {
          cwd: resolve(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
          env,
        });
        let output = '';
        child.stdout.on('data', data => { output += data; });
        child.stderr.on('data', data => { output += data; });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? done() : reject(new Error(output)));
      });
    }
  } finally {
    assert.equal(dirname(resolve(home)), resolve(tmpdir()));
    assert.ok(basename(home).startsWith('jbstock-i18n-'));
    rmSync(home, { recursive: true, force: true });
  }
});
