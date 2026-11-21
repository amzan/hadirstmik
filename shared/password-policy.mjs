export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 6 || new TextEncoder().encode(value).length > 1024) {
    throw Object.assign(new Error('PASSWORD_MIN_6'), { code: 'PASSWORD_MIN_6' });
  }
  const normalized = value.toLowerCase();
  const common = ['password', 'passwd', 'qwerty', 'letmein', 'welcome', 'admin', 'masuk', 'rahasia', 'dosen', 'mahasiswa', 'baak'];
  const sequential = ['01234567890123456789', '98765432109876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', 'qwertyuiop', 'poiuytrewq', 'asdfghjkl', 'lkjhgfdsa', 'zxcvbnm', 'mnbvcxz'];
  if (common.some(word => new RegExp(`^${word}[0-9!@#$%^&*._-]*$`).test(normalized)) ||
      /^(.{1,3})\1+$/.test(normalized) || sequential.some(sequence => sequence.includes(normalized))) {
    throw Object.assign(new Error('PASSWORD_TOO_WEAK'), { code: 'PASSWORD_TOO_WEAK' });
  }
  return value;
}

// Report encryption keeps its original passphrase floor independently of account policy.
export function validateReportPassphrase(value) {
  if (typeof value !== 'string' || value.length < 12 || new TextEncoder().encode(value).length > 1024) {
    throw Object.assign(new Error('REPORT_PASSPHRASE_MIN_12'), { code: 'REPORT_PASSPHRASE_MIN_12' });
  }
  return value;
}
