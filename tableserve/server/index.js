import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimal .env loader (KEY=value lines); real environment variables take precedence.
const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const { createApp, loadConfig } = await import('./app.js');
const { seed, DEMO_PASSWORD } = await import('./seed.js');

const config = loadConfig();
const { app, db } = createApp({ config });

if (db.get('SELECT COUNT(*) n FROM users').n === 0 && process.env.SEED_DEMO !== 'false') {
  seed(db);
  console.log(`[tableserve] Empty database – loaded DEMO data (password for all demo accounts: ${DEMO_PASSWORD}).`);
}

app.listen(config.port, () => {
  console.log(`[tableserve] Listening on ${config.appUrl} (port ${config.port})`);
  console.log(`[tableserve] Demo Table 5 QR links: ${config.appUrl}/t/demo-spice-kor-t5  and  ${config.appUrl}/t/demo-coastal-ban-t5`);
});
