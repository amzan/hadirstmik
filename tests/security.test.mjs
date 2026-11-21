import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, equal, otp, token, localDatabase, validateQr, safeUser } from '../backend/security.mjs';
import { prepareImport, canonical } from '../backend/importer.mjs';
import { input, dto } from '../backend/domain.mjs';
import { snapshotCipher } from '../backend/admin.mjs';
import { fixture } from './fixtures.mjs';

test('scrypt salts differ; valid, invalid and oversized passwords handled', async () => {
  const p = 'Synthetic-test-password-123', a = await hashPassword(p), b = await hashPassword(p);
  assert.notEqual(a, b); assert.equal(await verifyPassword(p, a), true); assert.equal(await verifyPassword('incorrect', a), false); assert.equal(await verifyPassword('x'.repeat(2048), a), false);
  await assert.rejects(hashPassword('short')); assert.equal(await verifyPassword(p, 'plaintext'), false);
});
test('opaque tokens and OTP use expected format; Unicode comparison does not crash', () => {
  assert.match(token(), /^[\w-]{43}$/); assert.match(otp(), /^\d{6}$/); assert.equal(equal('é', 'a'), false); assert.equal(equal(undefined, 'a'), false);
});
test('development and importer reject production and nonlocal DB targets', () => {
  assert.throws(() => localDatabase({ host: 'database.example.test', database: 'hadir_test' }));
  assert.throws(() => localDatabase({ host: '127.0.0.1', database: 'stmikkeb_hadir' }));
  assert.doesNotThrow(() => localDatabase({ host: '127.0.0.1', database: 'hadir_test' }));
});
test('QR rejects expired, prefix-only, closed and missing expiration', () => {
  const session = { is_open: 1, qr_token: token(), qr_expires_at: new Date(Date.now() + 10000) };
  validateQr(session, session.qr_token);
  assert.throws(() => validateQr(session, session.qr_token.slice(0, 10)));
  assert.throws(() => validateQr({ ...session, qr_expires_at: new Date(0) }, session.qr_token));
  assert.throws(() => validateQr({ ...session, is_open: 0 }, session.qr_token));
  assert.throws(() => validateQr({ ...session, qr_expires_at: null }, session.qr_token));
});
test('DTO projection never returns credentials and maps null/time/location', () => {
  assert.equal(safeUser({ id: 'test', password_hash: 'secret', role: 'admin' }).passwordHash, undefined);
  assert.equal(safeUser({ id:'demo', role:'dosen',is_demo:1 }).isDemo,true);
  assert.equal(safeUser({ id:'regular', role:'dosen',is_demo:0 }).isDemo,false);
  assert.equal(safeUser({ id:'untrusted', role:'dosen',isDemo:true }).isDemo,false);
  const result = dto({ start_time: '09:00:00', is_open: 0, latitude: '1.5', longitude: '2.5', location_accuracy: null, meeting_dates: '{"1":"2026-11-19"}', session_token_hash: 'secret' });
  assert.equal(result.startTime, '09:00'); assert.equal(result.isOpen, false); assert.equal(result.location.latitude, 1.5); assert.equal(result.sessionTokenHash, undefined);
});
test('field validation rejects secrets, invalid enum, invalid calendar and time', () => {
  assert.throws(() => input('users', { ...fixture().users[0], password: 'secret' }));
  assert.throws(() => input('users', { ...fixture().users[0], role: 'root' }));
  assert.throws(() => input('schedules', { meetingDates: { '1': '2026-02-30' } }, true));
  assert.throws(() => input('schedules', { startTime: '25:00' }, true));
});
test('import dry-run preserves original input and strips unsafe credentials', () => {
  const source = fixture(); source.users[0].password = 'unsafe-legacy-secret'; const before = JSON.stringify(source);
  const preview = prepareImport(source); assert.equal(preview.valid, true); assert.equal(JSON.stringify(source), before); assert.equal(JSON.stringify(preview.data).includes('unsafe-legacy-secret'), false);
  assert.equal(preview.data.students[0].userId, 'student-test'); assert.equal(preview.data.students[0].nim, '0001');
});
test('import reports duplicates, dangling references and missing rombel mappings without values', () => {
  const data = fixture(); data.records = [{ id: 'record-test', sessionId: 'missing', studentNim: 'missing', status: 'HADIR', verificationMethod: 'QR_SCAN', scannedAt: new Date().toISOString() }];
  data.users.push({ ...data.users[0] }); data.rombels = [];
  const preview = prepareImport(data); assert.equal(preview.valid, false); assert(preview.issues.some(i => i.code === 'DUPLICATE_ID')); assert(preview.issues.some(i => i.code === 'MISSING_SESSIONID')); assert(preview.issues.some(i => i.code === 'ROMBEL_MAPPING_REQUIRED'));
  assert(!JSON.stringify(preview.issues).includes('admin@example.test'));
});
test('snapshot authentication detects tampering and wrong encryption key', () => {
  const cipher = snapshotCipher('synthetic-encryption-key'); const value = cipher.encrypt(fixture()); assert.deepEqual(cipher.decrypt(value), fixture());
  assert.throws(() => snapshotCipher('different-key').decrypt(value)); assert.throws(() => cipher.decrypt(value.slice(0, -5) + 'AAAAA'));
});
test('canonical source hashing ignores object property order', () => assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 })));
