import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
const pg = new EmbeddedPostgres({
  databaseDir: '.local-db',
  user: 'invoiceflow',
  password: 'local_dev_only',
  port: 54331,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});
if (!existsSync('.local-db/PG_VERSION')) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('invoiceflow');
} catch (error) {
  if (!String(error).includes('already exists')) throw error;
}
console.log('Local PostgreSQL ready on 127.0.0.1:54331. Keep this terminal open.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await pg.stop();
    process.exit();
  });
setInterval(() => {}, 60000);
