const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { mkdtemp, mkdir, readFile, writeFile, rm, copyFile } = require('node:fs/promises');
const { tmpdir, cpus, totalmem } = require('node:os');
const { resolve, join, dirname, basename } = require('node:path');
const { randomBytes, createHash } = require('node:crypto');

const desktop = resolve(__dirname, '..');
const java = join(desktop, 'release/win-unpacked/resources/runtime/bin/java.exe');
const jar = resolve(desktop, '../Jbstock-backend/target/Jbstock-backend-0.0.1-SNAPSHOT.jar');
const variants = {
  baseline: [],
  bounded: ['-Xms32m', '-Xmx512m', '-XX:ActiveProcessorCount=2'],
};
const reportPath = join(desktop, 'release/startup-validation/comparison.json');
function waitExit(child, timeout = 35000) {
  let timer;
  return new Promise((done, reject) => {
    timer = setTimeout(() => reject(new Error('Process exit timeout')), timeout);
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); done(code); });
  }).finally(() => clearTimeout(timer));
}
async function measure(root, variant, round, benchmarkJar) {
  const home = join(root, variant);
  const statsPath = join(root, `${variant}-${round}.json`);
  const token = randomBytes(32).toString('hex');
  const env = { ...process.env, JBSTOCK_HOME: home, JBSTOCK_DATABASE_PATH: '', JBSTOCK_LOCAL_SESSION_TOKEN: token };
  for (const key of ['JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', 'SPRING_APPLICATION_JSON', 'SPRING_DATASOURCE_URL']) delete env[key];
  const started = performance.now();
  const child = spawn(java, [...variants[variant], '-jar', benchmarkJar, '--server.address=127.0.0.1', '--server.port=0',
    '--spring.datasource.url=', '--jbstock.desktop.stdin-control=true'],
    { env, detached: process.platform === 'win32', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  const exit = waitExit(child, 90000);
  const reader = createInterface({ input: child.stdout });
  const errors = createInterface({ input: child.stderr });
  const monitor = spawn(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-File', join(__dirname, 'measure-java.ps1'), '-JavaProcessId', String(child.pid), '-OutputPath', statsPath],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let monitorErrors = '';
  monitor.stderr.on('data', value => { monitorErrors += value; });
  const monitored = waitExit(monitor, 100000);
  try {
    let timer;
    const port = await new Promise((done, reject) => {
      timer = setTimeout(() => reject(new Error('Startup timeout')), 80000);
      reader.on('line', line => { const match = /^JBSTOCK_READY (\d+)$/.exec(line); if (match) done(Number(match[1])); });
      errors.on('line', line => { if (/^JBSTOCK_STARTUP_FAILED /.test(line)) reject(new Error(line)); });
      exit.then(() => reject(new Error('Backend exited before ready')), reject);
    }).finally(() => clearTimeout(timer));
    const origin = `http://127.0.0.1:${port}`;
    const health = await (await fetch(origin + '/health', { signal: AbortSignal.timeout(5000) })).json();
    assert.equal(health.status, 'UP');
    const headers = { 'X-JBStock-Local-Token': token, 'Content-Type': 'application/json' };
    const before = await fetch(origin + '/api/company', { headers, signal: AbortSignal.timeout(5000) });
    assert.equal(before.status, 200);
    const readyMs = Math.round(performance.now() - started);
    const profile = { name: 'Startup fixture', address: '', email: '', phone: '', fiscalIdentifiers: [] };
    const saved = await fetch(origin + '/api/company', { method: 'PUT', headers, body: JSON.stringify(profile), signal: AbortSignal.timeout(5000) });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), profile);
    child.stdin.end('JBSTOCK_SHUTDOWN\n');
    assert.equal(await exit, 0);
    assert.equal(await monitored, 0, monitorErrors);
    const stats = JSON.parse((await readFile(statsPath, 'utf8')).replace(/^\uFEFF/, ''));
    assert.ok(stats.samples > 0, 'No process measurements collected');
    assert.match((await readFile(join(home, 'logs/jbstock.log'), 'utf8')).trimEnd(), /LOGGING_STOPPED$/);
    return { variant, round, freshDatabase: round === 0, readyMs, ...stats };
  } finally {
    reader.close(); errors.close();
    if (child.exitCode === null) { child.kill(); await exit; }
    if (monitor.exitCode === null) await monitored;
  }
}
(async () => {
  assert.equal(process.platform, 'win32', 'This measurement uses the Windows bundled runtime');
  const root = await mkdtemp(join(tmpdir(), 'jbstock-startup-'));
  const benchmarkJar = join(root, 'jbstock.jar');
  await copyFile(jar, benchmarkJar);
  const report = { status: 'running', logicalProcessors: cpus().length, totalMemoryBytes: totalmem(),
    jarSha256: createHash('sha256').update(await readFile(benchmarkJar)).digest('hex'),
    scope: 'Java startup, health, company read/write and shutdown; excludes Electron, installer and second PC', variants, runs: [] };
  await mkdir(dirname(reportPath), { recursive: true });
  try {
    for (let round = 0; round < 2; round++) {
      for (const variant of round === 0 ? Object.keys(variants) : Object.keys(variants).reverse()) {
        report.runs.push(await measure(root, variant, round, benchmarkJar));
        await writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`${variant} round=${round}: ready=${report.runs.at(-1).readyMs}ms`);
      }
    }
    report.status = 'passed';
  } finally {
    if (report.status !== 'passed') report.status = 'failed';
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('jbstock-startup-'));
    await rm(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
