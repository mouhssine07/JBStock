const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { createInterface } = require('node:readline');
const { availableParallelism } = require('node:os');

class Backend extends EventEmitter {
  #token = randomBytes(32).toString('hex');
  #origin;
  #child;
  #exited;
  #stopping = false;
  #stopPromise;

  async start({ java, jar, home, database, timeout = 90000, command, args }) {
    if (this.#child) throw new Error('ALREADY_STARTED');
    const env = { ...process.env, JBSTOCK_LOCAL_SESSION_TOKEN: this.#token,
      JBSTOCK_DATABASE_PATH: database ?? '' };
    if (home) env.JBSTOCK_HOME = home;
    else delete env.JBSTOCK_HOME;
    // Avoid unrelated Spring/Java launcher settings changing the selected storage or networking.
    delete env.SPRING_APPLICATION_JSON;
    delete env.SPRING_DATASOURCE_URL;
    delete env.JAVA_TOOL_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;
    // Bound heap ergonomics and JVM internal pools on a merchant's shared desktop.
    // This is not an OS CPU quota or a limit on total Java/Electron resident memory.
    this.#child = spawn(command ?? java, args ?? ['-Xms32m', '-Xmx512m',
      `-XX:ActiveProcessorCount=${Math.min(2, availableParallelism())}`,
      '-jar', jar, '--server.address=127.0.0.1', '--server.port=0',
      '--spring.datasource.url=', '--jbstock.desktop.stdin-control=true'],
    // On Windows Java must survive the Electron main long enough to close Spring on stdin EOF.
    // Keep the pipes and process reference: normal shutdown still waits for this child, without unref.
    { env, detached: process.platform === 'win32', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.#child.stdin.on('error', () => {});
    this.#exited = new Promise(resolve => {
      this.#child.once('exit', (code) => {
        this.#origin = undefined;
        resolve(code);
        if (!this.#stopping) this.emit('unexpected-exit');
      });
      this.#child.once('error', () => resolve(-1));
    });
    let timer;
    const out = createInterface({ input: this.#child.stdout });
    const err = createInterface({ input: this.#child.stderr });
    try {
      const port = await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('STARTUP_TIMEOUT')), timeout);
        out.on('line', line => {
          const match = /^JBSTOCK_READY ([0-9]{1,5})$/.exec(line);
          if (match) {
            const port = Number(match[1]);
            if (port > 0 && port <= 65535) resolve(port);
            else reject(new Error('INVALID_PORT'));
          }
        });
        err.on('line', line => {
          const match = /^JBSTOCK_STARTUP_FAILED (STORAGE_ERROR|DATABASE_ERROR|MIGRATION_ERROR|STARTUP_ERROR)$/.exec(line);
          if (match) reject(new Error(match[1]));
        });
        this.#child.once('error', () => reject(new Error('JAVA_LAUNCH_FAILED')));
        this.#exited.then(() => reject(new Error('BACKEND_EXITED')));
      });
      this.#origin = `http://127.0.0.1:${port}`;
      const health = await this.#request('/health');
      if (health.status !== 'UP') throw new Error('BACKEND_NOT_HEALTHY');
      await this.company();
      if (this.#child.exitCode !== null || this.#child.signalCode !== null || this.#stopping) throw new Error('BACKEND_EXITED');
    } catch (error) {
      await this.stop(3000);
      throw error;
    } finally {
      clearTimeout(timer);
      // Continue draining pipes, but never forward arbitrary JVM output or secrets to the renderer.
      out.removeAllListeners('line');
      err.removeAllListeners('line');
    }
  }

  async #request(path, body) {
    if (!this.#origin || this.#stopping) throw new Error('BACKEND_UNAVAILABLE');
    const response = await fetch(this.#origin + path, {
      method: body === undefined ? 'GET' : 'PUT', redirect: 'error',
      headers: { 'X-JBStock-Local-Token': this.#token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(response.status === 400 ? 'INVALID_COMPANY' : 'BACKEND_REQUEST_FAILED');
    return response.json();
  }

  company() { return this.#request('/api/company'); }
  saveCompany(profile) { return this.#request('/api/company', profile); }

  stop(timeout = 30000) {
    if (this.#stopPromise) return this.#stopPromise;
    this.#stopping = true;
    this.#stopPromise = (async () => {
      if (!this.#child || this.#child.exitCode !== null) return;
      this.#child.stdin.end('JBSTOCK_SHUTDOWN\n');
      let timer;
      const finished = await Promise.race([this.#exited.then(() => true),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), timeout); })]);
      clearTimeout(timer);
      if (!finished) {
        this.#child.kill('SIGKILL'); // Direct Java child only; no shell/process tree to guess.
        await this.#exited;
        return { forced: true };
      }
      return { forced: false };
    })();
    return this.#stopPromise;
  }
}
module.exports = { Backend };
