import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_xxxxxxxxx';
const resend = new Resend(RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      from = 'onboarding@resend.dev',
      to = 'fauzan.ammar@gmail.com',
      subject = 'Hello World',
      html = '<p>Congrats on sending your <strong>first email</strong>!</p>',
      text
    } = req.body || {};

    if (!RESEND_API_KEY || RESEND_API_KEY === 're_xxxxxxxxx') {
      return res.status(400).json({
        success: false,
        error: 'API key Resend belum dikonfigurasi. Harap ganti re_xxxxxxxxx dengan API key asli Anda di environment variables Vercel (RESEND_API_KEY).'
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
}
