import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_xxxxxxxxx';
const resend = new Resend(RESEND_API_KEY);

export default async function handler(_req: any, res: any) {
  try {
    if (!RESEND_API_KEY || RESEND_API_KEY === 're_xxxxxxxxx') {
      return res.status(400).json({
        success: false,
        error: 'API key Resend belum diganti. Silakan ganti re_xxxxxxxxx dengan API key asli Anda di environment variables Vercel.'
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
}
