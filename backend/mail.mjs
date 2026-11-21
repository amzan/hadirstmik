import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
const emailAddress = value => typeof value === 'string' && /^[^\s@<>,;:"\\()[\]]+@[^\s@<>,;:"\\()[\]]+\.[^\s@<>,;:"\\()[\]]+$/.test(value);

export function mailTransport(env = process.env, createTransport = nodemailer.createTransport) {
  if (env.SMTP_CONFIG_PATH) {
    try { env = { ...env, ...JSON.parse(readFileSync(env.SMTP_CONFIG_PATH, 'utf8')) }; }
    catch { throw new Error('SMTP_CONFIG_INVALID'); }
  }
  if (env.SMTP_CONFIG_PATH || Object.keys(env).some(key => key.startsWith('SMTP_'))) {
    const host = env.SMTP_HOST, user = env.SMTP_USER || env.SMTP_USERNAME;
    const pass = env.SMTP_PASSWORD || env.SMTP_PASS, address = env.SMTP_FROM_EMAIL || user;
    const port = Number(env.SMTP_PORT || 587), name = env.SMTP_FROM_NAME || 'Akademik STMIK Kebumen';
    if (typeof host !== 'string' || !host || /[\s\r\n]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 ||
        typeof user !== 'string' || !user || typeof pass !== 'string' || !pass ||
        !emailAddress(address) || /[\r\n]/.test(name)) throw new Error('SMTP_CONFIG_INVALID');
    const transport = createTransport({ host, port, secure: false, requireTLS: true,
      auth: { user, pass }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: host },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
    const send = async (to, code, { purpose = 'verify' } = {}) => {
      if (!emailAddress(to) || !/^\d{6}$/.test(code || '')) throw new Error('MAIL_INPUT_INVALID');
      try {
        const info = await transport.sendMail({ from: { name, address }, to: { address: to },
          subject: purpose === 'reset' ? 'Reset kata sandi Hadir STMIK' : 'Verifikasi email Hadir STMIK',
          text: `Kode OTP Anda: ${code}. Berlaku 15 menit dan hanya dapat digunakan sekali. Jangan bagikan kode ini. Abaikan jika Anda tidak memintanya.` });
        if (!info.accepted?.length || info.rejected?.length) throw new Error('MAIL_DELIVERY_FAILED');
      } catch { throw new Error('MAIL_DELIVERY_FAILED'); }
    };
    send.verify = async () => { try { await transport.verify(); return true; } catch { throw new Error('SMTP_VERIFY_FAILED'); } };
    return send;
  }
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return undefined;
  const resend = new Resend(env.RESEND_API_KEY);
  return async (to, code) => {
    const { error } = await resend.emails.send({ from: env.RESEND_FROM_EMAIL, to, subject: 'Verifikasi akun Hadir STMIK', text: `Kode verifikasi: ${code}. Berlaku 15 menit. Abaikan jika Anda tidak meminta perubahan.` });
    if (error) throw new Error('MAIL_DELIVERY_FAILED');
  };
}
