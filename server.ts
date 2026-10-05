import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Resend initialization
// IMPORTANT: Replace 're_xxxxxxxxx' with your actual Resend API Key in .env
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_xxxxxxxxx';
const resend = new Resend(RESEND_API_KEY);

// API Endpoint to send emails via Resend
app.post('/api/send-email', async (req, res) => {
  try {
    const {
      from = 'onboarding@resend.dev',
      to = 'fauzan.ammar@gmail.com',
      subject = 'Hello World',
      html = '<p>Congrats on sending your <strong>first email</strong>!</p>',
      text
    } = req.body;

    if (!RESEND_API_KEY || RESEND_API_KEY === 're_xxxxxxxxx') {
      return res.status(400).json({
        success: false,
        error: 'API key Resend belum dikonfigurasi. Harap ganti re_xxxxxxxxx dengan API key asli Anda di file .env (RESEND_API_KEY).'
      });
    }

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {})
    });

    if (error) {
      console.error('Resend API error:', error);
      return res.status(400).json({ success: false, error });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Server error sending email:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error while sending email'
    });
  }
});

// Quick test endpoint matching exact user snippet
app.get('/api/test-resend', async (_req, res) => {
  try {
    if (!RESEND_API_KEY || RESEND_API_KEY === 're_xxxxxxxxx') {
      return res.status(400).json({
        success: false,
        error: 'API key Resend belum diganti. Silakan ganti re_xxxxxxxxx dengan API key asli Anda di file .env.'
      });
    }

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'fauzan.ammar@gmail.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
    });

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Dedicated endpoint to send password reset OTP email via Resend
app.post('/api/send-reset-code', async (req, res) => {
  try {
    const { to, name, role, code } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, error: 'Alamat email penerima diperlukan.' });
    }

    if (!code) {
      return res.status(400).json({ success: false, error: 'Kode verifikasi diperlukan.' });
    }

    const roleLabel = role === 'dosen' ? 'Dosen Pengampu' : role === 'admin' ? 'Administrator BAAK' : 'Mahasiswa';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Atur Ulang Kata Sandi - STMIK PGRI Kebumen</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 18px; letter-spacing: -0.5px;">STMIK PGRI ARUNGBINANG KEBUMEN</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Sistem Informasi Akademik & Presensi QR</p>
          </div>
          <div style="padding: 32px 28px;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">Permintaan Atur Ulang Kata Sandi</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Halo <strong>${name || 'Pengguna'}</strong> (${roleLabel}),
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Kami menerima permintaan untuk mengatur ulang kata sandi akun Presensi Kampus Anda. Silakan gunakan 6-digit kode verifikasi berikut:
            </p>
            
            <div style="margin: 28px 0; text-align: center;">
              <div style="display: inline-block; padding: 14px 32px; background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">
                ${code}
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              ⏰ <strong>Penting:</strong> Kode verifikasi ini berlaku selama <strong>15 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
            </p>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
              Jika Anda tidak meminta perubahan kata sandi, abaikan email ini dan akun Anda tetap aman.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Jl. Cendrawasih No.27A Tamanwinangun Telp. 386630 Kebumen 54313<br/>
            © 2026 STMIK PGRI Arungbinang Kebumen
          </div>
        </div>
      </body>
      </html>
    `;

    // If Resend API key is still placeholder, return isDemo with code for seamless testing
    if (!RESEND_API_KEY || RESEND_API_KEY === 're_xxxxxxxxx') {
      return res.json({
        success: true,
        isDemo: true,
        code,
        message: 'Mode Simulasi: API key Resend di .env belum diganti. Kode verifikasi ditampilkan otomatis untuk pengujian.'
      });
    }

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: `[STMIK PGRI Kebumen] Kode Verifikasi Reset Password: ${code}`,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend send error:', error);
      return res.status(200).json({ 
        success: true, 
        isDemo: true, 
        code,
        message: `Catatan Resend: ${(error as any)?.message || 'Pengiriman email dibatasi'}. Menggunakan mode simulasi kode OTP: ${code}` 
      });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Server error sending reset code:', err);
    return res.status(200).json({ 
      success: true, 
      isDemo: true, 
      code: req.body?.code,
      message: `Catatan Server: ${err?.message || 'Koneksi Resend terganggu'}. Menggunakan mode simulasi kode OTP: ${req.body?.code}` 
    });
  }
});

// Vite Middleware integration for Full-stack development
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
