const { createServer } = require('node:http');
const { createInterface } = require('node:readline');
const mode = process.argv[2];
if (mode === 'failure') { console.error('JBSTOCK_STARTUP_FAILED DATABASE_ERROR'); process.exit(1); }
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') response.end('{"status":"UP"}');
  else if (mode === 'bad-auth' || request.headers['x-jbstock-local-token'] !== process.env.JBSTOCK_LOCAL_SESSION_TOKEN) {
    response.writeHead(401); response.end('{}');
  } else response.end('{"name":"Fake demo"}');
});
server.listen(0, '127.0.0.1', () => {
  if (mode !== 'timeout') process.stdout.write(`JBSTOCK_READY ${server.address().port}\n`);
  if (mode === 'crash') setTimeout(() => process.exit(2), 1000);
});
const reader = createInterface({ input: process.stdin });
function stop() { if (mode !== 'ignore-stop') server.close(() => process.exit(0)); }
reader.on('line', line => { if (line === 'JBSTOCK_SHUTDOWN') stop(); });
reader.on('close', stop);
