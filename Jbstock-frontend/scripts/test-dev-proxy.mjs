import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { createServer as createViteServer, build } from 'vite'

const token = randomBytes(32).toString('hex')
let forwarded = 0
const backend = createHttpServer((request, response) => {
  if (request.url === '/health') {
    response.end('{"status":"UP"}')
    return
  }
  forwarded++
  response.setHeader('Content-Type', 'application/json')
  response.statusCode = request.headers['x-jbstock-local-token'] === token ? 200 : 401
  response.end('{"ok":true}')
})
await new Promise((done) => backend.listen(0, '127.0.0.1', done))
process.env.JBSTOCK_BACKEND_URL = `http://127.0.0.1:${backend.address().port}`
process.env.JBSTOCK_LOCAL_SESSION_TOKEN = token
let vite
try {
  vite = await createViteServer({ logLevel: 'silent' })
  await vite.listen()
  const endpoint = 'http://127.0.0.1:5173/api/company'
  for (const method of ['GET', 'PUT']) {
    const response = await fetch(endpoint, {
      method,
      headers: { 'sec-fetch-site': 'same-origin', 'X-JBStock-Local-Token': 'client-value-must-be-overwritten' },
    })
    assert.equal(response.status, 200)
    assert.ok(!(await response.text()).includes(token))
  }
  assert.equal(forwarded, 2)
  for (const headers of [
    {},
    { 'sec-fetch-site': 'cross-site', origin: 'https://foreign.example' },
    { 'sec-fetch-site': 'same-origin', origin: 'https://foreign.example' },
  ]) {
    assert.equal((await fetch(endpoint, { headers })).status, 403, JSON.stringify(headers))
  }
  const badHostStatus = await new Promise((done, reject) => {
    const request = httpRequest(endpoint, {
      headers: { 'sec-fetch-site': 'same-origin', host: 'foreign.example:5173' },
    }, (response) => { response.resume(); done(response.statusCode) })
    request.on('error', reject)
    request.end()
  })
  assert.equal(badHostStatus, 403)
  assert.equal(forwarded, 2, 'Rejected requests must never reach the backend')
  assert.equal((await fetch('http://127.0.0.1:5173/api/health', {
    headers: { 'sec-fetch-site': 'same-origin' },
  })).status, 200)
  const source = await (await fetch('http://127.0.0.1:5173/src/App.tsx')).text()
  assert.ok(!source.includes(token))
  await vite.close()
  vite = undefined

  // Build with the secret set as in development: it must not enter emitted assets.
  const outputs = await build({ logLevel: 'silent', build: { write: false } })
  for (const output of Array.isArray(outputs) ? outputs : [outputs]) {
    for (const item of output.output) {
      assert.ok(!String(item.type === 'chunk' ? item.code : item.source).includes(token))
    }
  }
  process.env.JBSTOCK_LOCAL_SESSION_TOKEN = ''
  await assert.rejects(() => createViteServer({ logLevel: 'silent' }), /local session token required/)
  process.env.JBSTOCK_LOCAL_SESSION_TOKEN = token
  process.env.JBSTOCK_BACKEND_URL = 'https://foreign.example'
  await assert.rejects(() => createViteServer({ logLevel: 'silent' }), /127.0.0.1/)
  console.log('Development proxy checks passed: forwarding, origin protection, startup validation, no secret in client assets.')
} finally {
  if (vite) await vite.close()
  backend.closeAllConnections()
  await new Promise((done) => backend.close(done))
  delete process.env.JBSTOCK_LOCAL_SESSION_TOKEN
}
