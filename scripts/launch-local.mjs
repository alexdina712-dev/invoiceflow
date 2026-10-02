// Desktop supervisor: one owner for the local database, API, and web server.
import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const stateFile = resolve('.runtime/launcher.json');
const token = randomBytes(32).toString('hex');
const databaseUrl = new URL(
  process.env.DATABASE_URL || 'postgresql://invoiceflow:local_dev_only@127.0.0.1:54331/invoiceflow',
);
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname))
  throw new Error(
    'The Desktop launcher only starts a local database. Use the README for managed hosting.',
  );
const environment = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '4002',
  APP_ORIGIN: 'http://127.0.0.1:5175',
};
const pg = new EmbeddedPostgres({
  databaseDir: resolve('.local-db'),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  port: Number(databaseUrl.port || 54331),
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});
const children = new Set();
let databaseStarted = false;
let stopping = false;
let ready = false;
mkdirSync('.runtime', { recursive: true });

function child(args) {
  const processChild = spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(processChild);
  processChild.once('exit', () => children.delete(processChild));
  return processChild;
}
function run(args) {
  return new Promise((accept, reject) => {
    const processChild = child(args);
    processChild.once('error', reject);
    processChild.once('exit', (code) =>
      code === 0 ? accept() : reject(new Error(`${args[0]} exited with code ${code}`)),
    );
  });
}
async function stop() {
  if (stopping) return;
  stopping = true;
  ready = false;
  console.log('Stopping InvoiceFlow.');
  for (const processChild of [...children]) {
    if (process.platform === 'win32' && processChild.pid) {
      await new Promise((accept) => {
        const killer = spawn('taskkill.exe', ['/PID', String(processChild.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('exit', accept);
        killer.once('error', accept);
      });
    } else processChild.kill('SIGTERM');
  }
  if (databaseStarted) await pg.stop();
  if (existsSync(stateFile)) unlinkSync(stateFile);
  controller.close();
}
const controller = createServer(async (req, res) => {
  const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
  const authorized =
    Buffer.byteLength(supplied) === Buffer.byteLength(token) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
  if (!authorized || req.headers.origin) {
    res.writeHead(403).end();
    return;
  }
  if (req.url === '/status' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ready, root }));
    return;
  }
  if (req.url === '/stop' && req.method === 'POST') {
    res.end('Stopping');
    await stop();
    process.exit(0);
    return;
  }
  res.writeHead(404).end();
});
await new Promise((accept) => controller.listen(0, '127.0.0.1', accept));
const address = controller.address();
writeFileSync(
  stateFile,
  JSON.stringify(
    { pid: process.pid, root, controlUrl: `http://127.0.0.1:${address.port}`, token },
    null,
    2,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await stop();
    process.exit(0);
  });
try {
  for (const port of [4002, 5175, Number(databaseUrl.port || 54331)]) {
    await new Promise((accept, reject) => {
      const probe = createServer();
      probe.once('error', () =>
        reject(
          new Error(
            'Port ' +
              port +
              ' is already in use. Stop the existing local dev server before using this launcher.',
          ),
        ),
      );
      probe.listen(port, '127.0.0.1', () => probe.close(accept));
    });
  }
  console.log('Building InvoiceFlow from ' + root);
  await run(['node_modules/typescript/bin/tsc', '--noEmit']);
  await run(['node_modules/vite/bin/vite.js', 'build']);
  await run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json']);
  if (!existsSync('.local-db/PG_VERSION')) await pg.initialise();
  await pg.start();
  databaseStarted = true;
  const client = pg.getPgClient('postgres');
  await client.connect();
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  const existing = await client.query('SELECT datname FROM pg_database WHERE datname=$1', [
    databaseName,
  ]);
  await client.end();
  if (!existing.rows.length) await pg.createDatabase(databaseName);
  await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  await run(['dist-server/prisma/seed.js']);
  for (const args of [
    ['dist-server/server/index.js'],
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort'],
  ]) {
    const service = child(args);
    service.once('exit', async (code) => {
      if (!stopping) {
        console.error('InvoiceFlow service exited with code ' + code);
        await stop();
        process.exit(1);
      }
    });
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const [api, web] = await Promise.all([
        fetch('http://127.0.0.1:4002/api/health'),
        fetch('http://127.0.0.1:5175'),
      ]);
      if (!stopping && api.ok && web.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((accept) => setTimeout(accept, 250));
  }
  if (!ready)
    throw new Error('InvoiceFlow services did not become ready. Check the runtime logs.');
  console.log('InvoiceFlow ready at http://127.0.0.1:5175');
} catch (error) {
  console.error(error);
  await stop();
  process.exit(1);
}
