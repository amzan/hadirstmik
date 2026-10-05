/**
 * Client service to communicate with the server-side Resend proxy
 */

export interface SendEmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Sends an email using the backend Resend proxy endpoint (/api/send-email).
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResponse> {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Gagal mengirim email via Resend.');
  }

  return result;
}

/**
 * Sends a test email to fauzan.ammar@gmail.com matching the initial setup snippet.
 */
export async function sendTestEmail(): Promise<SendEmailResponse> {
  const response = await fetch('/api/test-resend');
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Gagal mengirim email uji coba.');
  }
  return result;
}

export interface SendResetCodeParams {
  to: string;
  name: string;
  role: string;
  code: string;
}

/**
 * Sends a 6-digit password reset OTP email via Resend
 */
export async function sendPasswordResetEmail(params: SendResetCodeParams): Promise<{
  success: boolean;
  isDemo?: boolean;
  code?: string;
  message?: string;
}> {
  const response = await fetch('/api/send-reset-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();
  if (!response.ok && !result.success) {
    throw new Error(result.error || 'Gagal mengirim kode verifikasi reset password.');
  }
  return result;
}
