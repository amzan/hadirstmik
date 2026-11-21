import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePassword, validateReportPassphrase } from '../shared/password-policy.mjs';
import { generateTemporaryPassword } from '../backend/accounts.mjs';
import { hashPassword, verifyPassword } from '../backend/security.mjs';
import { lecturerLoginBase } from '../backend/lecturer-login.mjs';

test('manual passwords accept six strong characters and reject short, common, repeated and sequential values', () => {
  for (const value of ['N7k!pR', 'nK7vQr', 'Long-existing-password-12345']) assert.equal(validatePassword(value), value);
  for (const value of ['N7k!p', '123456', 'password', 'abcdef', '654321', 'aaaaaa', 'abcabc', 'ababab', 'qwerty', 'Password123', 'admin123']) {
    assert.throws(() => validatePassword(value), { code: value.length < 6 ? 'PASSWORD_MIN_6' : 'PASSWORD_TOO_WEAK' });
  }
  assert.throws(() => validatePassword('x'.repeat(1025)), { code: 'PASSWORD_MIN_6' });
});

test('automatic passwords contain exactly six mixed alphanumeric characters using cryptographic randomness', async () => {
  for (let index = 0; index < 250; index++) {
    const value = generateTemporaryPassword();
    assert.match(value, /^[A-Za-z0-9]{6}$/); assert.match(value, /[a-z]/); assert.match(value, /[A-Z]/); assert.match(value, /[0-9]/);
    assert.equal(validatePassword(value), value);
  }
  const source = await readFile(new URL('../backend/accounts.mjs', import.meta.url), 'utf8');
  assert(source.includes("from 'node:crypto'")); assert(source.includes('randomInt(alphabet.length)')); assert(!source.includes('Math.random'));
});

test('six-character passwords retain scrypt while existing longer hashes remain valid', async () => {
  for (const value of ['N7k!pR', 'Long-existing-password-12345']) {
    const hash = await hashPassword(value); assert.match(hash, /^scrypt\$v1\$/); assert(await verifyPassword(value, hash));
  }
});

test('encrypted activation reports retain their independent twelve-character passphrase floor', () => {
  assert.throws(() => validateReportPassphrase('N7k!pR'), { code: 'REPORT_PASSPHRASE_MIN_12' });
  assert.equal(validateReportPassphrase('Synthetic-report-passphrase'), 'Synthetic-report-passphrase');
});

test('lecturer name normalization strips only explicitly recognized leading academic titles', () => {
  for (const name of ['Dr. Ahmad Synthetic', 'PROF. Drs. Ahmad Synthetic', 'Dra Ahmad Synthetic', 'Ir. H. Ahmad Synthetic']) assert.equal(lecturerLoginBase(name), 'ahmad');
  assert.equal(lecturerLoginBase('Drajat Synthetic'), 'drajat');
  assert.equal(lecturerLoginBase('Sir Ahmad Synthetic'), 'sir');
  assert.equal(lecturerLoginBase('  Éka Synthetic  '), 'eka');
});
