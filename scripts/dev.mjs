import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createServer } from 'node:net'

// Development only. Electron will own the production process lifecycle.
const root = fileURLToPath(new URL('../', import.meta.url))
const env = {
  ...process.env,
  JBSTOCK_LOCAL_SESSION_TOKEN: randomBytes(32).toString('hex'),
  JBSTOCK_HOME: resolve(root, 'Jbstock-backend/target/dev-data'),
  JBSTOCK_DATABASE_PATH: resolve(root, 'Jbstock-backend/target/dev-data/jbstock.db'),
  JBSTOCK_BACKEND_URL: 'http://127.0.0.1:8080',
  SERVER_ADDRESS: '127.0.0.1',
  SERVER_PORT: '8080',
}
const children = new Set()
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) {
    if (process.platform === 'win32') {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* already stopped */ }
    }
  }
}

function start(command, args, directory) {
  const windows = process.platform === 'win32'
  const child = windows
    ? spawn('cmd.exe', ['/d', '/s', '/c', `${command}.cmd ${args.join(' ')}`],
      { cwd: resolve(root, directory), env, stdio: 'inherit', windowsHide: true })
    : spawn(command, args, { cwd: resolve(root, directory), env, stdio: 'inherit', detached: true })
  children.add(child)
  child.on('error', () => { children.delete(child); console.error(`Unable to launch ${command}. Check its installation.`); stop(1) })
  child.on('exit', (code) => { children.delete(child); if (!stopping) stop(code || 1) })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

// Never attach a fresh frontend to an unrelated backend already using the port.
const probe = createServer()
try {
  await new Promise((done, reject) => {
    probe.once('error', reject)
    probe.listen(8080, '127.0.0.1', done)
  })
  await new Promise((done) => probe.close(done))
  start('mvn', ['spring-boot:run'], 'Jbstock-backend')
  let ready = false
  const deadline = Date.now() + 90_000
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`${env.JBSTOCK_BACKEND_URL}/api/company`, {
        headers: { 'X-JBStock-Local-Token': env.JBSTOCK_LOCAL_SESSION_TOKEN },
        signal: AbortSignal.timeout(1500),
      })
      if (response.ok) { ready = true; break }
    } catch { /* backend is still starting */ }
    await new Promise((done) => setTimeout(done, 500))
  }
  if (!stopping) {
    if (!ready) throw new Error('Backend did not become ready within 90 seconds.')
    start('npm', ['run', 'dev'], 'Jbstock-frontend')
    console.log('JBStock development: http://127.0.0.1:5173 — Ctrl+C to stop.')
  }
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? 'Port 8080 is already in use. Stop the existing backend first.' : error.message)
  stop(1)
}
