import { Router } from 'express';
import { randomBytes, randomInt, pbkdf2 as deriveCallback, createCipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { rows, transaction, audit } from './database.mjs';
import { asyncRoute, requireValue, text, password, hashPassword, verifyPassword, keyedDigest } from './security.mjs';
import { validatePassword, validateReportPassphrase } from '../shared/password-policy.mjs';
import { ensureLecturerLoginAliases } from './lecturer-login.mjs';

const derive = promisify(deriveCallback);
export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (;;) {
    const value = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) continue;
    try { return validatePassword(value); } catch {}
  }
}
function reportPassphrase(value) {
  try { return validateReportPassphrase(value); } catch (error) { requireValue(false, error.code); }
}
export function accountDto(row) {
  return { id: row.id, name: row.name, username: row.username, loginAlias: row.login_alias, role: row.role, email: row.email, isDemo: Boolean(row.is_demo),
    hasCredentials: Boolean(row.has_credentials), mustChangePassword: Boolean(row.must_change_password), emailVerified: Boolean(row.email_verified_at) };
}
function selection(value, actor) {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= 50, 'ACCOUNT_BATCH_LIMIT');
  const ids = value.map(id => text(id, 100)).sort();
  requireValue(new Set(ids).size === ids.length, 'ACCOUNT_DUPLICATE');
  requireValue(!ids.includes(actor), 'CURRENT_ADMIN_EXCLUDED');
  return ids;
}
async function selected(db, ids, lock = false, demoScope = false) {
  const result = await rows(db, `SELECT u.*,c.user_id IS NOT NULL AS has_credentials,c.must_change_password FROM users u LEFT JOIN user_credentials c ON c.user_id=u.id WHERE u.id IN (${ids.map(() => '?').join(',')}) AND u.is_active=1 AND u.is_demo=? ORDER BY u.id${lock ? ' FOR UPDATE' : ''}`, [...ids,Number(demoScope)]);
  requireValue(result.length === ids.length, 'ACCOUNT_NOT_FOUND', 404);
  return result;
}
export async function encryptActivationReport(accounts, passphrase) {
  reportPassphrase(passphrase);
  const salt = randomBytes(16), iv = randomBytes(12), iterations = 600000;
  const key = await derive(passphrase, salt, iterations, 32, 'sha256');
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ accounts }), 'utf8'), cipher.final()]);
    return { format: 'HADIR-ACTIVATION-1', kdf: 'PBKDF2-SHA256', iterations, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  } finally { key.fill(0); }
}
export async function revokeAccountAccess(db, id) {
  await rows(db, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND status='ACTIVE'", [id]);
  await rows(db, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [id]);
  await rows(db, 'UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [id]);
}
export async function updateAccountEmail(db, id, value, actor, allowAdmin = false) {
  const email = text(value, 255).toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'EMAIL_INVALID');
  // Serialize account email changes, including legacy rows without a unique email index.
  const accounts = await rows(db, 'SELECT id,email,role FROM users ORDER BY id FOR UPDATE');
  const account = accounts.find(row => row.id === id);
  requireValue(account, 'ACCOUNT_NOT_FOUND', 404);
  requireValue(['dosen', 'mahasiswa'].includes(account.role) || (allowAdmin && account.role === 'admin'), 'ACCOUNT_ROLE_INVALID');
  requireValue(!accounts.some(row => row.id !== id && row.email?.toLowerCase() === email), 'EMAIL_IN_USE', 409);
  const duplicate = await rows(db, 'SELECT nim FROM students WHERE LOWER(email)=? AND (user_id IS NULL OR user_id<>?) LIMIT 1 FOR UPDATE', [email, id]);
  requireValue(!duplicate.length, 'EMAIL_IN_USE', 409);
  if (account.email !== email) {
    await rows(db, 'UPDATE users SET email=?,email_verified_at=NULL,version=version+1 WHERE id=?', [email, id]);
    await rows(db, 'UPDATE students SET email=?,version=version+1 WHERE user_id=?', [email, id]);
    await rows(db, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [id]);
    await rows(db, 'UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [id]);
    await rows(db,'INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,created_at,change_details) VALUES (?,?,?,?,UTC_TIMESTAMP(),?)',[actor,'ACCOUNT_EMAIL_CHANGED','user',id,JSON.stringify({field:'email',oldValue:account.email,newValue:email})]);
  }
  return { id, email, emailVerified: false };
}
export function accountManagement(pool, auth, secret) {
  const router = Router();
  router.use(auth.required, auth.role('admin'));
  router.get('/', asyncRoute(async (req, res) => {
    await ensureLecturerLoginAliases(pool, {isDemo:Boolean(req.user.demoScope)});
    const accounts = await rows(pool, 'SELECT u.*,c.user_id IS NOT NULL AS has_credentials,c.must_change_password FROM users u LEFT JOIN user_credentials c ON c.user_id=u.id WHERE u.is_active=1 AND u.is_demo=? ORDER BY u.name,u.id', [Number(req.user.demoScope)]);
    res.json({ data: accounts.map(accountDto) });
  }));
  router.patch('/:id/email', asyncRoute(async (req, res) => {
    const result = await transaction(pool, async db => {
      await selected(db, [text(req.params.id,100)], true, req.user.demoScope);
      return updateAccountEmail(db, text(req.params.id, 100), req.body.email, req.user.id);
    });
    res.json({ data: result });
  }));
  router.post('/activation-preview', asyncRoute(async (req, res) => {
    await ensureLecturerLoginAliases(pool, {isDemo:Boolean(req.user.demoScope)});
    const accounts = await selected(pool, selection(req.body.userIds, req.user.id), false, req.user.demoScope);
    res.json({ data: { accounts: accounts.map(accountDto), count: accounts.length, existingCredentialCount: accounts.filter(row => row.has_credentials).length } });
  }));
  router.post('/activate', asyncRoute(async (req, res) => {
    const ids = selection(req.body.userIds, req.user.id), requestId = text(req.body.requestId, 100);
    requireValue(/^[A-Za-z0-9_-]{16,100}$/.test(requestId), 'REQUEST_ID_INVALID');
    reportPassphrase(req.body.reportPassphrase);
    if (req.body.manualPassword !== undefined) { requireValue(ids.length === 1, 'MANUAL_PASSWORD_SINGLE_ONLY'); password(req.body.manualPassword); }
    await auth.limit(`account-activation:${req.user.id}`, 10);
    const [credential] = await rows(pool, 'SELECT password_hash FROM user_credentials WHERE user_id=?', [req.user.id]);
    requireValue(await verifyPassword(req.body.adminPassword, credential?.password_hash), 'REAUTH_INVALID', 401);
    await ensureLecturerLoginAliases(pool, {isDemo:Boolean(req.user.demoScope)});
    const requestHash = keyedDigest(secret, JSON.stringify({ ids, confirm: req.body.confirmExistingCredentials === true, manual: req.body.manualPassword || null, passphrase: req.body.reportPassphrase }));
    const result = await transaction(pool, async db => {
      // A single ordered account lock also prevents concurrent manual-password reuse.
      await rows(db, 'SELECT id FROM users ORDER BY id FOR UPDATE');
      const [admin] = await rows(db, 'SELECT u.role,u.is_active,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE u.id=? FOR UPDATE', [req.user.id]);
      requireValue(admin?.role === 'admin' && admin.is_active && admin.password_hash === credential.password_hash, 'REAUTH_INVALID', 401);
      const [session] = await rows(db, "SELECT id FROM device_sessions WHERE id=? AND user_id=? AND status='ACTIVE' AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE", [req.authSessionId, req.user.id]);
      requireValue(session, 'AUTH_REQUIRED', 401);
      const [prior] = await rows(db, 'SELECT admin_id,request_hash FROM account_activation_operations WHERE request_id=? FOR UPDATE', [requestId]);
      if (prior) { requireValue(prior.admin_id === req.user.id && prior.request_hash === requestHash, 'IDEMPOTENCY_CONFLICT', 409); requireValue(false, 'REPORT_ALREADY_DELIVERED', 409); }
      const accounts = await selected(db, ids, true, req.user.demoScope);
      requireValue(req.body.confirmExistingCredentials === true || accounts.every(row => !row.has_credentials), 'EXISTING_CREDENTIAL_CONFIRMATION_REQUIRED', 409);
      if (req.body.manualPassword !== undefined) {
        requireValue(req.body.manualPassword !== req.body.reportPassphrase, 'REPORT_PASSPHRASE_MUST_DIFFER');
        for (const existing of await rows(db, 'SELECT password_hash FROM user_credentials')) {
          requireValue(!await verifyPassword(req.body.manualPassword, existing.password_hash), 'TEMPORARY_PASSWORD_ALREADY_USED', 409);
        }
      }
      const reports = [], hashes = [], generated = new Set();
      for (const account of accounts) {
        let temporaryPassword = req.body.manualPassword;
        if (temporaryPassword === undefined) do { temporaryPassword = generateTemporaryPassword(); } while (generated.has(temporaryPassword) || temporaryPassword === req.body.reportPassphrase);
        generated.add(temporaryPassword);
        reports.push({ name: account.name, username: account.username, loginAlias: account.login_alias || undefined, role: account.role, temporaryPassword });
        hashes.push(await hashPassword(temporaryPassword));
      }
      // Encrypt before any credential writes; only this response can deliver the report.
      const report = await encryptActivationReport(reports, req.body.reportPassphrase);
      for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        await rows(db, 'INSERT INTO user_credentials (user_id,password_hash,must_change_password) VALUES (?,?,TRUE) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),must_change_password=TRUE,password_updated_at=UTC_TIMESTAMP()', [account.id, hashes[index]]);
        await revokeAccountAccess(db, account.id);
        await audit(db, req.user.id, 'ACCOUNT_TEMPORARY_PASSWORD_SET', 'user', account.id);
      }
      await rows(db, 'INSERT INTO account_activation_operations (request_id,admin_id,request_hash,account_count) VALUES (?,?,?,?)', [requestId, req.user.id, requestHash, accounts.length]);
      return { count: accounts.length, report };
    });
    res.json({ data: result });
  }));
  return router;
}
export async function updateAccountIdentifier(db, id, raw, actor) {
  const identifier = text(raw, 50);
  const accounts = await rows(db, 'SELECT id,role,username,nidn,login_alias FROM users ORDER BY id FOR UPDATE');
  const account = accounts.find(row => row.id === id);
  requireValue(account && ['mahasiswa','dosen'].includes(account.role), 'ACCOUNT_ROLE_INVALID');
  const conflicts = await rows(db, 'SELECT id FROM users WHERE id<>? AND (username=? OR nidn=? OR login_alias=? OR email=?) LIMIT 1', [id, identifier, identifier, identifier, identifier]);
  requireValue(!conflicts.length, 'IDENTIFIER_IN_USE', 409);
  const students = await rows(db, 'SELECT nim,user_id FROM students ORDER BY nim FOR UPDATE');
  requireValue(!(await rows(db, 'SELECT nim FROM students WHERE nim=? AND (user_id IS NULL OR user_id<>?)', [identifier,id])).length, 'IDENTIFIER_IN_USE', 409);
  const student = students.find(row => row.user_id === id);
  if (account.role === 'mahasiswa') requireValue(student, 'ACCOUNT_MAPPING_INVALID', 409);
  const previous = account.role === 'mahasiswa' ? student.nim : account.nidn;
  if (identifier === previous && identifier === account.username) return identifier;
  try {
  if (student && account.role === 'mahasiswa') await rows(db, 'UPDATE students SET nim=?,version=version+1 WHERE user_id=?', [identifier,id]);
  await rows(db, 'UPDATE users SET username=?,nidn=CASE WHEN role=\'dosen\' THEN ? ELSE nidn END,login_alias=CASE WHEN (login_alias=? OR login_alias=?) AND login_alias<>? THEN NULL ELSE login_alias END WHERE id=?', [identifier,identifier,account.username,account.nidn,identifier,id]);
  await rows(db, 'INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,created_at,change_details) VALUES (?,?,?,?,UTC_TIMESTAMP(),?)', [actor,'ACCOUNT_IDENTIFIER_CHANGED','user',id,JSON.stringify({field:account.role==='mahasiswa'?'nim':'nidn',oldValue:previous,newValue:identifier,oldUsername:account.username,newUsername:identifier})]);
  return identifier;
  } catch(error) { if(error.code==='ER_DUP_ENTRY') requireValue(false,'IDENTIFIER_IN_USE',409); throw error; }
}


