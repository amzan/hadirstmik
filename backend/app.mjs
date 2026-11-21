import express from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { authentication } from './auth.mjs';
import { domain } from './domain.mjs';
import { administration } from './admin.mjs';
import { proofs } from './proofs.mjs';
import { accountManagement } from './accounts.mjs';
import { avatars } from './avatar.mjs';
import { digest,equal,requireValue } from './security.mjs';

export function createApp({ pool, origin, secret, production = false, sendOtp, staticRoot, proxyTrust = /** @type {boolean|string} */ (false), backupSecret=secret, staging=false, stagingUsername='', stagingPasswordHash='' }) {
  requireValue(new URL(origin).origin===origin && (!production || origin.startsWith('https://')),'APP_ORIGIN_INVALID',503);
  if(staging)requireValue(stagingUsername && /^[a-f0-9]{64}$/.test(stagingPasswordHash),'STAGING_ACCESS_REQUIRED',503);
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', proxyTrust);
  if(staging)app.use((req,res,next)=>{
    let user='',password='';
    if(req.get('authorization')?.startsWith('Basic ')){const value=Buffer.from(req.get('authorization').slice(6),'base64').toString('utf8'),at=value.indexOf(':');if(at>=0){user=value.slice(0,at);password=value.slice(at+1);}}
    if(!equal(user,stagingUsername)||!equal(digest(password),stagingPasswordHash))return res.status(401).set('WWW-Authenticate','Basic realm="Hadir STMIK staging"').end();
    next();
  });
  app.use((req, res, next) => {
    req.requestId = randomUUID(); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  app.get('/api/v1/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.get('/api/v1/ready', async (_req, res) => { try { await pool.execute({ sql: 'SELECT 1', timeout: 3000 }); res.json({ data: { ready: true } }); } catch { res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database belum siap.' } }); } });
  const auth = authentication(pool, { origin, secret, production, sendOtp });
  app.use('/api/v1', auth.csrf, auth.identify, auth.initialPasswordGate);
  app.use('/api/v1/auth', auth.router);
  app.use('/api/v1/admin/accounts', accountManagement(pool, auth, secret));
  app.use('/api/v1/admin', administration(pool, auth, backupSecret));
  app.use('/api/v1/leave-proofs', proofs(pool, auth));
  app.use('/api/v1/avatars', avatars(pool, auth));
  app.use('/api/v1', domain(pool, auth));
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'API_NOT_FOUND', message: 'Endpoint tidak tersedia.' }, requestId: req.requestId }));
  app.use('/private', (_req, res) => res.sendStatus(404));
  if (staticRoot) { app.use(express.static(resolve(staticRoot), { dotfiles: 'deny', index: false })); app.get('*', (_req, res) => res.sendFile(resolve(staticRoot, 'index.html'))); }
  app.use((error, req, res, _next) => {
    const conflict = ['ER_DUP_ENTRY', 'ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code);
    const status = error.status || (conflict ? 409 : 503);
    const code = conflict ? 'DATA_CONFLICT' : error.code?.startsWith('ER_') || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code) ? 'DATABASE_UNAVAILABLE' : error.code || 'INTERNAL_ERROR';
    res.status(status).json({ error: { code, message: code === 'IDENTIFIER_IN_USE' ? 'data yang dimasukan sudah ada' : status >= 500 ? 'Layanan belum siap. Data belum disimpan.' : code }, requestId: req.requestId });
  });
  return app;
}

