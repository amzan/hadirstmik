import { validatePassword } from '../../shared/password-policy.mjs';

export function validateAccountPassword(value: string): void {
  try { validatePassword(value); }
  catch (error) {
    throw new Error((error as { code?: string }).code === 'PASSWORD_TOO_WEAK'
      ? 'Kata sandi terlalu umum atau mudah ditebak. Pilih kombinasi lain.'
      : 'Kata sandi minimal 6 karakter dan maksimal 1024 byte.');
  }
}
