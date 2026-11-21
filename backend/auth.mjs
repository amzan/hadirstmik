import { Router } from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { token, digest, otp, keyedDigest, equal, cookies, hashPassword, verifyPassword, password, text, roles, requireValue, HttpError, safeUser, asyncRoute } from './security.mjs';
import { rows, transaction, audit } from './database.mjs';
import { revokeAccountAccess, updateAccountEmail } from './accounts.mjs';
import { ensureLecturerLoginAliases } from './lecturer-login.mjs';

export function authentication(pool, { origin, secret, production = false, sendOtp, now = () => Date.now() }) {
  requireValue(typeof secret === 'string' && secret.length >= 32, 'AUTH_SECRET_REQUIRED', 503);
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  const csrfFor = nonce => keyedDigest(secret, `csrf:${nonce}`);
  const router = Router();
  const dummyHash = hashPassword(token());

  async function limit(key, maximum = 5, seconds = 900) {
    const bucket = keyedDigest(secret, key);
    await rows(pool, `INSERT INTO auth_limits (bucket,hits,reset_at) VALUES (?,1,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE hits=IF(reset_at<=UTC_TIMESTAMP(),1,hits+1), reset_at=IF(reset_at<=UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),reset_at)`, [bucket, seconds, seconds]);
    const [state] = await rows(pool, 'SELECT hits FROM auth_limits WHERE bucket=?', [bucket]);
    requireValue(state.hits <= maximum, 'TOO_MANY_ATTEMPTS', 429);
  }
  const csrf = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const nonce = cookies(req.headers.cookie).hadir_csrf;
    if (req.get('origin') !== origin || !nonce || !equal(req.get('x-csrf-token'), csrfFor(nonce))) return next(new HttpError(403, 'CSRF_INVALID'));
    if (!req.is('application/json')) return next(new HttpError(415, 'JSON_REQUIRED'));
    next();
  };
  const identify = asyncRoute(async (req, _res, next) => {
    const raw = cookies(req.headers.cookie).hadir_session;
    if (raw) {
      const [session] = await rows(pool, `SELECT ds.id AS session_id, ds.user_id, u.*,c.must_change_password FROM device_sessions ds JOIN users u ON u.id=ds.user_id LEFT JOIN user_credentials c ON c.user_id=u.id
        WHERE ds.session_token_hash=? AND ds.status='ACTIVE' AND ds.revoked_at IS NULL AND ds.expires_at>UTC_TIMESTAMP()
        AND COALESCE(ds.last_active_at,ds.login_at)>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 HOUR) AND u.is_active=1`, [digest(raw)]);
      if (session) { req.user = safeUser(session); req.user.demoScope = req.user.isDemo || (req.user.role === 'admin' && req.get('X-Hadir-Demo') === '1'); req.authSessionId = session.session_id; }
    }
    next();
  });
  const required = (req, _res, next) => next(req.user ? undefined : new HttpError(401, 'AUTH_REQUIRED'));
  const role = (...allowed) => (req, _res, next) => next(req.user && allowed.includes(req.user.role) ? undefined : new HttpError(403, 'FORBIDDEN'));

  router.get('/csrf', (req, res) => {
    const prior=cookies(req.headers.cookie).hadir_csrf;
    const nonce = typeof prior==='string'&&/^[A-Za-z0-9_-]{43}$/.test(prior)?prior:token();
    res.cookie('hadir_csrf', nonce, { ...cookieOptions, sameSite: 'strict' });
    res.json({ data: { csrfToken: csrfFor(nonce) } });
  });
  router.post('/login', asyncRoute(async (req, res) => {
    requireValue(!req.user, 'LOGOUT_REQUIRED', 409);
    const identifier = text(req.body.identifier, 255), requestedRole = text(req.body.role, 20);
    requireValue(roles.includes(requestedRole));
    await limit(`login-ip:${req.ip}`, 30);
    await limit(`login-account:${identifier.toLowerCase()}:${requestedRole}`, 10);
    if (requestedRole === 'dosen') {
      const matching = await rows(pool, "SELECT is_demo FROM users WHERE role='dosen' AND is_active=1 AND (LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?) OR LOWER(nidn)=LOWER(?) OR login_alias=LOWER(?)) LIMIT 2", [identifier,identifier,identifier,identifier]);
      await ensureLecturerLoginAliases(pool, {isDemo:matching.length === 1 && Boolean(matching[0].is_demo)});
    }
    const candidates = await rows(pool, `SELECT u.*,c.password_hash,c.must_change_password FROM users u LEFT JOIN user_credentials c ON c.user_id=u.id
      WHERE (LOWER(u.username)=LOWER(?) OR LOWER(u.email)=LOWER(?) OR LOWER(u.nidn)=LOWER(?) OR (u.role='dosen' AND u.login_alias=LOWER(?))) AND u.role=? AND u.is_active=1 LIMIT 2`, [identifier, identifier, identifier, identifier, requestedRole]);
    const user = candidates.length === 1 ? candidates[0] : null;
    if (user) await limit(`login-user:${user.id}`, 10);
    const valid = await verifyPassword(req.body.password, user?.password_hash || await dummyHash);
    requireValue(valid && user, 'LOGIN_INVALID', 401);
    const raw = token(), id = token();
    await transaction(pool, async db => {
      const [lockedUser] = await rows(db, 'SELECT is_active FROM users WHERE id=? FOR UPDATE', [user.id]);
      const [credential] = await rows(db, 'SELECT password_hash FROM user_credentials WHERE user_id=? FOR UPDATE', [user.id]);
      requireValue(lockedUser?.is_active && equal(credential?.password_hash, user.password_hash), 'LOGIN_INVALID', 401);
      const prior = cookies(req.headers.cookie).hadir_session;
      if (prior) await rows(db, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE session_token_hash=?", [digest(prior)]);
      await rows(db, `INSERT INTO device_sessions (id,user_id,device_id,device_name,device_type,browser,os,ip_address,session_token_hash,last_active_at,expires_at)
        VALUES (?,?,?,?,'desktop',?,?,?, ?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))`, [id, user.id, digest(req.get('user-agent') || 'browser'), (req.get('user-agent') || 'Browser').slice(0, 200), 'Browser', 'Unknown', req.ip || null, digest(raw)]);
      await audit(db, user.id, 'LOGIN', 'device_session', id);
    });
    res.cookie('hadir_session', raw, { ...cookieOptions, maxAge: 86400000 });
    res.json({ data: safeUser(user) });
  }));
  router.get('/me', required, (req, res) => res.json({ data: req.user }));
  router.post('/password/change', required, asyncRoute(async (req, res) => {
    requireValue(Object.keys(req.body).every(key => ['currentPassword', 'newPassword', 'confirmPassword'].includes(key)), 'PROFILE_FIELD_FORBIDDEN', 403);
    await limit(`password-change-ip:${req.ip}`, 20);
    await limit(`password-change-user:${req.user.id}`, 5);
    password(req.body.newPassword);
    requireValue(req.body.newPassword === req.body.confirmPassword, 'PASSWORD_CONFIRMATION_MISMATCH');
    const hash = await hashPassword(req.body.newPassword);
    await transaction(pool, async db => {
      await rows(db, 'SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      const [session] = await rows(db, "SELECT id FROM device_sessions WHERE id=? AND user_id=? AND status='ACTIVE' AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE", [req.authSessionId, req.user.id]);
      requireValue(session, 'AUTH_REQUIRED', 401);
      const [credential] = await rows(db, 'SELECT password_hash,must_change_password FROM user_credentials WHERE user_id=? FOR UPDATE', [req.user.id]);
      requireValue(!credential?.must_change_password, 'PASSWORD_CHANGE_REQUIRED', 403);
      requireValue(await verifyPassword(req.body.currentPassword, credential?.password_hash), 'CURRENT_PASSWORD_INVALID', 401);
      requireValue(!await verifyPassword(req.body.newPassword, credential.password_hash), 'PASSWORD_MUST_DIFFER');
      await rows(db, 'UPDATE user_credentials SET password_hash=?,must_change_password=FALSE,password_updated_at=UTC_TIMESTAMP() WHERE user_id=?', [hash, req.user.id]);
      await revokeAccountAccess(db, req.user.id);
      await audit(db, req.user.id, 'PASSWORD_CHANGED', 'user', req.user.id);
    });
    res.clearCookie('hadir_session', cookieOptions);
    res.json({ data: { success: true } });
  }));
  router.post('/initial-password', required, asyncRoute(async (req, res) => {
    password(req.body.newPassword);
    const hash = await hashPassword(req.body.newPassword);
    await transaction(pool, async db => {
      await rows(db, 'SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      const [session] = await rows(db, "SELECT id FROM device_sessions WHERE id=? AND user_id=? AND status='ACTIVE' AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE", [req.authSessionId, req.user.id]);
      requireValue(session, 'AUTH_REQUIRED', 401);
      const [credential] = await rows(db, 'SELECT password_hash,must_change_password FROM user_credentials WHERE user_id=? FOR UPDATE', [req.user.id]);
      requireValue(credential?.must_change_password, 'INITIAL_PASSWORD_NOT_REQUIRED', 409);
      requireValue(!await verifyPassword(req.body.newPassword, credential.password_hash), 'PASSWORD_MUST_DIFFER');
      await rows(db, 'UPDATE user_credentials SET password_hash=?,must_change_password=FALSE,password_updated_at=UTC_TIMESTAMP() WHERE user_id=?', [hash, req.user.id]);
      await revokeAccountAccess(db, req.user.id);
      await audit(db, req.user.id, 'INITIAL_PASSWORD_CHANGED', 'user', req.user.id);
    });
    res.clearCookie('hadir_session', cookieOptions);
    res.json({ data: { success: true } });
  }));
  router.post('/heartbeat', required, asyncRoute(async (req, res) => {
    await rows(pool, 'UPDATE device_sessions SET last_active_at=UTC_TIMESTAMP() WHERE id=?', [req.authSessionId]); res.json({ data: { active: true } });
  }));
  router.post('/logout', asyncRoute(async (req, res) => {
    if (req.authSessionId) await rows(pool, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE id=?", [req.authSessionId]);
    res.clearCookie('hadir_session', cookieOptions); res.json({ data: { success: true } });
  }));
  router.get('/device-sessions', required, asyncRoute(async (req, res) => {
    const sessions = await rows(pool, `SELECT s.id,s.user_id,s.device_id,s.device_name,s.device_type,s.browser,s.os,s.ip_address,s.login_at,s.last_active_at,s.expires_at,s.revoked_at,s.status,u.username,u.name,u.role
      FROM device_sessions s JOIN users u ON u.id=s.user_id WHERE (?='admin' OR s.user_id=?) AND u.is_demo=? ORDER BY s.login_at DESC LIMIT 100`, [req.user.role,req.user.id,Number(req.user.demoScope)]);
    res.json({ data: sessions.map(s => ({ id: s.id, userId: s.user_id, userUsername: s.username, userName: s.name, userRole: s.role, deviceId: s.device_id, deviceName: s.device_name, deviceType: s.device_type, browser: s.browser, os: s.os, ipSimulated: s.ip_address || '', locationCity: '', loginTimestamp: new Date(s.login_at).getTime(), lastActiveTimestamp: new Date(s.last_active_at || s.login_at).getTime(), status: !s.revoked_at && new Date(s.expires_at).getTime() > now() && new Date(s.last_active_at||s.login_at).getTime()>now()-2*60*60000 ? s.status : 'TERMINATED', isCurrentDevice: s.id === req.authSessionId })) });
  }));
  router.post('/device-sessions/revoke-others', required, asyncRoute(async (req, res) => {
    const result = await rows(pool, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND id<>? AND status='ACTIVE'", [req.user.id, req.authSessionId]);
    res.json({ data: { count: result.affectedRows } });
  }));
  router.delete('/device-sessions/:id', required, asyncRoute(async (req, res) => {
    await rows(pool, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE (?='admin' OR user_id=?) AND id=? AND user_id IN (SELECT id FROM users WHERE is_demo=?)", [req.user.role,req.user.id, req.params.id,Number(req.user.demoScope)]);
    res.json({ data: { success: true } });
  }));
  router.post('/email-verification/request', required, asyncRoute(async (req, res) => {
    requireValue(!req.user.isDemo, 'DEMO_EMAIL_DISABLED', 403);
    requireValue(Object.keys(req.body).length === 0, 'PROFILE_FIELD_FORBIDDEN', 403);
    requireValue(typeof sendOtp === 'function', 'MAIL_NOT_CONFIGURED', 503);
    await limit(`verify-ip:${req.ip}`, 20);
    await limit(`verify-user:${req.user.id}`, 3);
    await limit(`verify-cooldown:${req.user.id}`, 1, 60);
    const id = token(), code = otp();
    const email = await transaction(pool, async db => {
      const [user] = await rows(db, 'SELECT email,email_verified_at,is_active FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      requireValue(user?.is_active, 'AUTH_REQUIRED', 401);
      requireValue(!user.email_verified_at, 'EMAIL_ALREADY_VERIFIED', 409);
      requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email), 'EMAIL_INVALID');
      await rows(db, "UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND purpose='verify' AND used_at IS NULL", [req.user.id]);
      await rows(db, "INSERT INTO auth_challenges (id,user_id,purpose,token_hash,expires_at) VALUES (?,?,'verify',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))", [id, req.user.id, keyedDigest(secret, `${id}:${code}:${user.email.toLowerCase()}`)]);
      return user.email;
    });
    try { await sendOtp(email, code, { purpose: 'verify' }); }
    catch { await rows(pool, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE id=?', [id]); await audit(pool, req.user.id, 'OTP_VERIFY_DELIVERY_FAILED', 'auth_challenge', id); throw new HttpError(503, 'MAIL_DELIVERY_FAILED'); }
    await audit(pool, req.user.id, 'OTP_VERIFY_SENT', 'auth_challenge', id);
    res.status(202).json({ data: { challengeId: id, expiresIn: 900, cooldown: 60 } });
  }));
  router.post('/email-verification/confirm', required, asyncRoute(async (req, res) => {
    requireValue(!req.user.isDemo, 'DEMO_EMAIL_DISABLED', 403);
    requireValue(Object.keys(req.body).every(key => ['challengeId', 'code'].includes(key)), 'PROFILE_FIELD_FORBIDDEN', 403);
    const id = text(req.body.challengeId, 100), code = text(req.body.code, 6);
    await limit(`verify-confirm-ip:${req.ip}`, 30);
    const success = await transaction(pool, async db => {
      const [user] = await rows(db, 'SELECT email,is_active FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      const [challenge] = await rows(db, 'SELECT * FROM auth_challenges WHERE id=? FOR UPDATE', [id]);
      if (!user?.is_active || user.is_demo || !challenge || challenge.user_id !== req.user.id || challenge.purpose !== 'verify' || challenge.used_at || challenge.attempts >= 5 || new Date(challenge.expires_at).getTime() <= now()) return false;
      await rows(db, 'UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?', [id]);
      if (!equal(challenge.token_hash, keyedDigest(secret, `${id}:${code}:${user.email.toLowerCase()}`))) return false;
      await rows(db, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE id=?', [id]);
      await rows(db, 'UPDATE users SET email_verified_at=UTC_TIMESTAMP(),version=version+1 WHERE id=?', [req.user.id]);
      await audit(db, req.user.id, 'EMAIL_VERIFIED', 'user', req.user.id);
      return true;
    });
    requireValue(success, 'CHALLENGE_INVALID', 400);
    res.json({ data: { success: true, emailVerified: true } });
  }));
  router.post('/password-reset/verify', asyncRoute(async(req,res)=>{
    const id=text(req.body.challengeId,100), code=text(req.body.code,6); await limit(`confirm-ip:${req.ip}`,30);
    const valid=await transaction(pool,async db=>{
      const [lookup]=await rows(db,'SELECT user_id FROM auth_challenges WHERE id=?',[id]);
      const [user]=lookup?.user_id ? await rows(db,'SELECT is_active,email,is_demo FROM users WHERE id=? FOR UPDATE',[lookup.user_id]) : [];
      const [challenge]=await rows(db,'SELECT * FROM auth_challenges WHERE id=? FOR UPDATE',[id]);
      if(!user?.is_active || user.is_demo || !challenge || challenge.purpose!=='reset' || !challenge.user_id || challenge.used_at || challenge.attempts>=5 || new Date(challenge.expires_at).getTime()<=now())return false;
      const matches=equal(challenge.token_hash,keyedDigest(secret,`${id}:${code}:${user.email.toLowerCase()}`));
      if(!matches)await rows(db,'UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?',[id]);
      return matches;
    }); requireValue(valid,'CHALLENGE_INVALID',400);res.json({data:{verified:true}});
  }));

  for (const purpose of ['reset', 'change']) {
    router.post(`/password-${purpose}/request`, ...(purpose === 'change' ? [required] : []), asyncRoute(async (req, res) => {
      const started = now();
      if (purpose === 'change') requireValue(!req.user.isDemo, 'DEMO_EMAIL_DISABLED', 403);
      requireValue(typeof sendOtp === 'function', 'MAIL_NOT_CONFIGURED', 503);
      const identifier = purpose === 'change' ? req.user.username : text(req.body.identifier, 255);
      const requestedRole = purpose === 'change' ? req.user.role : req.body.role;
      requireValue(roles.includes(requestedRole));
      await limit(`otp-ip:${req.ip}`, 20); await limit(`otp-account:${identifier.toLowerCase()}:${requestedRole}`, 3);
      await limit(`otp-cooldown:${identifier.toLowerCase()}:${requestedRole}`, 1, 60);
      const candidates = await rows(pool, 'SELECT id,email,email_verified_at FROM users WHERE (username=? OR email=? OR nidn=?) AND role=? AND is_active=1 AND is_demo=0 LIMIT 2', [identifier, identifier, identifier, requestedRole]);
      const candidate = candidates.length === 1 ? candidates[0] : null;
      const user = candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email) ? candidate : null;
      const id = token(), code = otp();
      let deliver = Boolean(user);
      await transaction(pool, async db => {
        if (user) {
          const [locked] = await rows(db, 'SELECT email,email_verified_at,is_active FROM users WHERE id=? FOR UPDATE', [user.id]);
          const recent = await rows(db, 'SELECT id FROM auth_challenges WHERE user_id=? AND purpose=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 SECOND) LIMIT 1', [user.id, purpose]);
          deliver = Boolean(locked?.is_active && locked.email === user.email && !recent.length);
          if (deliver) await rows(db, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND purpose=? AND used_at IS NULL', [user.id, purpose]);
        }
        await rows(db, 'INSERT INTO auth_challenges (id,user_id,purpose,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))', [id, deliver ? user.id : null, purpose, keyedDigest(secret, purpose === 'reset' && deliver ? `${id}:${code}:${user.email.toLowerCase()}` : `${id}:${code}`)]);
      });
      await audit(pool, null, `OTP_${purpose.toUpperCase()}_${deliver ? 'REQUESTED' : 'SKIPPED'}`, 'auth_challenge', id);
      if (deliver) {
        try {
          await sendOtp(user.email, code, { purpose });
          await audit(pool, null, `OTP_${purpose.toUpperCase()}_SENT`, 'auth_challenge', id);
        } catch {
          await rows(pool, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE id=?', [id]);
          await audit(pool, null, `OTP_${purpose.toUpperCase()}_DELIVERY_FAILED`, 'auth_challenge', id);
        }
      }
      await delay(Math.max(0, 750 - (now() - started)));
      res.status(202).json({ data: { challengeId: id, message: 'Jika akun memenuhi syarat, kode dikirim ke email terdaftar.' } });
    }));
    router.post(`/password-${purpose}/confirm`, ...(purpose === 'change' ? [required] : []), asyncRoute(async (req, res) => {
      const id = text(req.body.challengeId, 100), code = text(req.body.code, 6);
      password(req.body.newPassword);
      const newEmail=purpose==='change' && req.body.newEmail ? text(req.body.newEmail,255) : null;
      if(newEmail) requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail),'EMAIL_INVALID');
      await limit(`confirm-ip:${req.ip}`, 30);
      const hash = await hashPassword(req.body.newPassword);
      const success = await transaction(pool, async db => {
        const [lookup] = await rows(db, 'SELECT user_id FROM auth_challenges WHERE id=?', [id]);
        const [user] = lookup?.user_id ? await rows(db, 'SELECT is_active,email,is_demo FROM users WHERE id=? FOR UPDATE', [lookup.user_id]) : [];
        const [challenge] = await rows(db, 'SELECT * FROM auth_challenges WHERE id=? FOR UPDATE', [id]);
        if (!user?.is_active || user.is_demo || !challenge || challenge.purpose !== purpose || challenge.used_at || new Date(challenge.expires_at).getTime() <= now() || challenge.attempts >= 5) return false;
        await rows(db, 'UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?', [id]);
        if (!challenge.user_id || !equal(challenge.token_hash, keyedDigest(secret, purpose === 'reset' ? `${id}:${code}:${user.email.toLowerCase()}` : `${id}:${code}`)) || (purpose === 'change' && challenge.user_id !== req.user.id)) return false;
        const [credential] = await rows(db, 'SELECT must_change_password FROM user_credentials WHERE user_id=? FOR UPDATE', [challenge.user_id]);
        requireValue(!credential?.must_change_password, 'PASSWORD_CHANGE_REQUIRED', 403);
        await rows(db, 'INSERT INTO user_credentials (user_id,password_hash,must_change_password) VALUES (?,?,FALSE) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),must_change_password=FALSE,password_updated_at=UTC_TIMESTAMP()', [challenge.user_id, hash]);
        if(newEmail) await updateAccountEmail(db,challenge.user_id,newEmail,challenge.user_id,true);
        await rows(db, 'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [challenge.user_id]);
        await rows(db, "UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND status='ACTIVE'", [challenge.user_id]);
        await audit(db, challenge.user_id, 'PASSWORD_CHANGED', 'user', challenge.user_id);
        return true;
      });
      requireValue(success, 'CHALLENGE_INVALID', 400);
      res.clearCookie('hadir_session', cookieOptions);
      res.json({ data: { success: true, message: 'Kata sandi diperbarui. Silakan masuk kembali.' } });
    }));
  }
  const initialPasswordGate = (req, _res, next) => {
    const allowed = ['/auth/me', '/auth/csrf', '/auth/logout', '/auth/heartbeat', '/auth/initial-password'];
    next(req.user?.mustChangePassword && !allowed.includes(req.path) ? new HttpError(403, 'PASSWORD_CHANGE_REQUIRED') : undefined);
  };
  return { router, identify, required, role, csrf, limit, initialPasswordGate };
}
