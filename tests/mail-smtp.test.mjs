import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import nodemailer from 'nodemailer';
import { mailTransport } from '../backend/mail.mjs';

const config = { SMTP_HOST: 'localhost', SMTP_PORT: '587', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'Synthetic-SMTP-secret-123', SMTP_FROM_EMAIL: 'sender@example.test' };

test('SMTP requires STARTTLS, trusted certificates and private auth; never logs or accepts multiple recipients', async () => {
  let options, message;
  const send = mailTransport(config, value => {
    options = value;
    return { sendMail: async value => { message = value; return { accepted: [value.to.address], rejected: [] }; }, verify: async () => true };
  });
  assert.equal(options.requireTLS, true); assert.equal(options.secure, false);
  assert.equal(options.tls.rejectUnauthorized, true); assert.equal(options.tls.minVersion, 'TLSv1.2');
  assert.equal(options.logger, false); assert.equal(options.debug, false);
  assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true);
  assert.equal(await send.verify(), true);
  await send('student@example.test', '123456', { purpose: 'reset' });
  assert.equal(message.to.address, 'student@example.test'); assert.match(message.subject, /Reset/);
  assert.match(message.text, /15 menit/); assert.match(message.text, /sekali/);
  for (const address of ['bad', 'one@example.test,two@example.test', 'one@example.test\r\nBcc:other@example.test']) await assert.rejects(send(address, '123456'), /MAIL_INPUT_INVALID/);
  await assert.rejects(send('student@example.test', '12345'), /MAIL_INPUT_INVALID/);
  assert.throws(() => mailTransport({ ...config, SMTP_PASSWORD: '' }), /SMTP_CONFIG_INVALID/);
  assert.throws(() => mailTransport({ SMTP_CONFIG_PATH: join(tmpdir(), 'missing-hadir-smtp-config.json') }), /SMTP_CONFIG_INVALID/);
});

test('SMTP delivery and verification failures expose only sanitized errors', async () => {
  const send = mailTransport(config, () => ({ sendMail: async () => { throw Error(config.SMTP_PASSWORD); }, verify: async () => { throw Error(config.SMTP_PASSWORD); } }));
  await assert.rejects(send('student@example.test', '123456'), { message: 'MAIL_DELIVERY_FAILED' });
  await assert.rejects(send.verify(), { message: 'SMTP_VERIFY_FAILED' });
  const refused = mailTransport(config, () => ({ sendMail: async () => ({ accepted: [], rejected: ['student@example.test'] }) }));
  await assert.rejects(refused('student@example.test', '123456'), /MAIL_DELIVERY_FAILED/);
});

test('real SMTP mock upgrades to TLS before authentication and delivers exactly one OTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hadir-smtp-test-'));
  const sockets = new Set(), messages = []; let authenticated = 0, server;
  try {
    const keyFile = join(directory, 'key.pem'), certFile = join(directory, 'cert.pem');
    execFileSync(process.env.HADIR_TEST_OPENSSL || 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore', windowsHide: true });
    const cert = await readFile(certFile), context = tls.createSecureContext({ key: await readFile(keyFile), cert });
    server = net.createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
      const attach = (stream, secure) => {
        let buffer = '', data = false, body = '';
        const listener = chunk => {
          buffer += chunk.toString();
          while (buffer.includes('\r\n')) {
            const index = buffer.indexOf('\r\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
            if (data) { if (line === '.') { messages.push(body); data = false; stream.write('250 Queued\r\n'); } else body += line + '\n'; continue; }
            if (/^EHLO/.test(line)) stream.write(secure ? '250-localhost\r\n250 AUTH PLAIN\r\n' : '250-localhost\r\n250 STARTTLS\r\n');
            else if (line === 'STARTTLS') {
              assert.equal(secure, false); stream.removeListener('data', listener); stream.write('220 Ready to start TLS\r\n');
              const upgraded = new tls.TLSSocket(stream, { isServer: true, secureContext: context }); upgraded.on('error', () => {}); attach(upgraded, true); return;
            } else if (line.startsWith('AUTH PLAIN ')) {
              assert.equal(secure, true); assert.equal(Buffer.from(line.slice(11), 'base64').toString(), '\0' + config.SMTP_USER + '\0' + config.SMTP_PASSWORD); authenticated++; stream.write('235 Authenticated\r\n');
            } else if (/^(MAIL FROM|RCPT TO)/.test(line)) stream.write('250 OK\r\n');
            else if (line === 'DATA') { data = true; body = ''; stream.write('354 Send data\r\n'); }
            else if (line === 'QUIT') stream.end('221 Bye\r\n');
            else stream.write('250 OK\r\n');
          }
        }; stream.on('data', listener);
      };
      socket.write('220 localhost SMTP mock\r\n'); attach(socket, false);
    }).listen(0, '127.0.0.1'); await once(server, 'listening');
    const env = { ...config, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port) };
    const send = mailTransport(env, options => nodemailer.createTransport({ ...options, tls: { ...options.tls, ca: cert, servername: 'localhost' } }));
    assert.equal(await send.verify(), true); await send('student@example.test', '123456', { purpose: 'verify' });
    assert.equal(authenticated, 2); assert.equal(messages.length, 1); assert.match(messages[0], /123456/);
  } finally {
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise(resolve => server.close(resolve));
    assert(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true });
  }
});

test('SMTP without STARTTLS fails before sending credentials', async () => {
  const commands = []; const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    socket.write('220 localhost mock\r\n'); socket.on('data', chunk => { commands.push(chunk.toString()); socket.write('250 localhost\r\n'); });
  }).listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const send = mailTransport({ ...config, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port) });
    await assert.rejects(send('student@example.test', '123456'), /MAIL_DELIVERY_FAILED/);
    assert(!commands.join('').includes('AUTH')); assert(!commands.join('').includes(config.SMTP_PASSWORD));
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
});
