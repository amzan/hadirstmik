import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './backend/app.mjs';
import { createPool } from './backend/database.mjs';
import { mailTransport } from './backend/mail.mjs';
import { token } from './backend/security.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const origin = process.env.APP_ORIGIN || (production ? '' : `http://localhost:${port}`);
const secret = process.env.AUTH_SECRET || (production ? '' : token());
if (!origin || (production && !origin.startsWith('https://'))) throw new Error('APP_ORIGIN_HTTPS_REQUIRED');
if (production && (!process.env.BACKUP_SECRET || process.env.BACKUP_SECRET.length<32)) throw new Error('BACKUP_SECRET_REQUIRED');
const pool = createPool();
const app = createApp({ pool, origin, secret, production, sendOtp: mailTransport(), staticRoot: production ? path.join(root, 'dist') : undefined, proxyTrust: process.env.TRUST_PROXY === 'loopback' ? 'loopback' : false,backupSecret:process.env.BACKUP_SECRET||secret,staging:process.env.STAGING==='1',stagingUsername:process.env.STAGING_USERNAME,stagingPasswordHash:process.env.STAGING_PASSWORD_HASH });
if (!production) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () => console.log(`Hadir STMIK listening on port ${port}`));
async function stop() { server.close(); await pool.end(); }
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
