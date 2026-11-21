import { rows, transaction, audit } from './database.mjs';

export function lecturerLoginBase(name) {
  const withoutTitles = String(name).trim().replace(/^(?:(?:prof|drs|dra|dr|ir|hj|h)\.?\s+)+/i, '');
  return withoutTitles.split(/\s+/)[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80) || 'dosen';
}

export async function ensureLecturerLoginAliases(pool, { isDemo = false } = {}) {
  const pending = await rows(pool, "SELECT id FROM users WHERE role='dosen' AND login_alias IS NULL AND is_demo=? LIMIT 1", [Number(isDemo)]);
  if (!pending.length) return;
  await transaction(pool, async db => {
    // Ordered locks serialize allocations with email changes and activation batches.
    const accounts = await rows(db, 'SELECT id,role,name,username,email,nidn,login_alias,is_demo FROM users ORDER BY id FOR UPDATE');
    const reserved = new Map();
    for (const account of accounts) {
      const identifiers = account.role === 'dosen' ? [account.username, account.email, account.nidn, account.login_alias] : [account.login_alias];
      for (const value of identifiers.filter(Boolean)) {
        const key = value.toLowerCase();
        if (!reserved.has(key)) reserved.set(key, new Set());
        reserved.get(key).add(account.id);
      }
    }
    for (const account of accounts.filter(account => account.role === 'dosen' && !account.login_alias && Boolean(account.is_demo) === isDemo)) {
      const base = lecturerLoginBase(account.name);
      let alias = base, suffix = 2;
      while ((reserved.has(alias) && [...reserved.get(alias)].some(id => id !== account.id)) ||
        (await rows(db, "SELECT id FROM users WHERE id<>? AND (login_alias=? OR (role='dosen' AND (username=? OR email=? OR nidn=?))) LIMIT 1", [account.id, alias, alias, alias, alias])).length) alias = `${base}${suffix++}`;
      await rows(db, 'UPDATE users SET login_alias=? WHERE id=? AND login_alias IS NULL', [alias, account.id]);
      reserved.set(alias, new Set([account.id]));
      await audit(db, null, 'LECTURER_LOGIN_ALIAS_ASSIGNED', 'user', account.id);
    }
  });
}
