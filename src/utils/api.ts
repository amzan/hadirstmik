let csrfToken = '';
let csrfRequest: Promise<void> | undefined;
let generation = 0;
let demoScope = false;
let demoActor = false;
export function setApiDemoActor(enabled: boolean) { demoActor = enabled; }
export function isDemoDataScope() { return demoScope || demoActor; }
export function setApiDemoScope(enabled: boolean) { if (demoScope !== enabled) { demoScope = enabled; generation++; } }
export function isApiDemoScope() { return demoScope; }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function invalidateApiSession() { demoScope = false; demoActor = false; csrfToken = ''; csrfRequest = undefined; generation++; }
export function sessionGeneration() { return generation; }
async function csrf() {
  if (csrfToken) return;
  const attempt = generation;
  csrfRequest ||= fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new ApiError(response.status, 'SERVER_UNAVAILABLE', 'Server belum siap.');
    const value = (await response.json()).data.csrfToken;
    if (attempt === generation) csrfToken = value;
  }).finally(() => { csrfRequest = undefined; });
  await csrfRequest;
}
export async function apiResponse(path: string, method = 'GET', body?: unknown) {
  const attempt = generation;
  if (method !== 'GET') await csrf();
  if (attempt !== generation) throw new ApiError(409, 'SESSION_CHANGED', 'Sesi berubah. Silakan coba kembali.');
  const response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(demoScope ? { 'X-Hadir-Demo': '1' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
  const result = await response.json().catch(() => ({}));
  if (attempt !== generation) throw new ApiError(409, 'SESSION_CHANGED', 'Sesi berubah. Silakan coba kembali.');
  if (!response.ok) {
    const code = result.error?.code || 'REQUEST_FAILED';
    if (code === 'IDENTIFIER_IN_USE') throw new ApiError(response.status, code, 'data yang dimasukan sudah ada');
    if (response.status === 401 && !['REAUTH_INVALID', 'CURRENT_PASSWORD_INVALID'].includes(code)) { invalidateApiSession(); window.dispatchEvent(new Event('hadir-session-expired')); }
    const messages: Record<string,string>={SESSION_TIME_ENDED:'Waktu akhir sesi sudah lewat. Sesuaikan tanggal dan jam pelaksanaan yang sebenarnya.',SESSION_MEETING_COMPLETED:'Pertemuan sudah selesai. Pilih pertemuan berikutnya atau minta admin melakukan Reset Sesi.',LEAVE_RECIPIENT_DUPLICATE:'Dosen penerima tidak boleh dipilih dua kali.',LEAVE_RECIPIENTS_REQUIRED:'Pilih minimal satu dosen penerima.',RECIPIENT_INVALID:'Dosen penerima tidak aktif atau tidak tersedia.',LOGOUT_REQUIRED:'Keluar dari akun saat ini sebelum masuk menggunakan akun lain.',AVATAR_TOO_LARGE:'Foto terlalu besar. Gunakan gambar maksimal 1 MB.',AVATAR_FORMAT_INVALID:'Gunakan foto JPG atau PNG yang valid.',AVATAR_CONTENT_INVALID:'Isi foto tidak valid atau rusak.',AVATAR_STORAGE_NOT_CONFIGURED:'Penyimpanan foto belum tersedia. Foto sebelumnya tetap digunakan.',EMAIL_INVALID:'Format email tidak valid.',EMAIL_IN_USE:'Email sudah digunakan akun lain.',ACCOUNT_BATCH_LIMIT:'Pilih 1 sampai 50 akun.',CURRENT_ADMIN_EXCLUDED:'Akun admin yang sedang login tidak dapat diproses.',REAUTH_INVALID:'Password admin tidak valid. Periksa dan coba kembali.',EXISTING_CREDENTIAL_CONFIRMATION_REQUIRED:'Konfirmasikan reset akun yang sudah berkredensial.',REPORT_ALREADY_DELIVERED:'Laporan sudah diberikan satu kali. Jika hilang, buat preview baru dan lakukan reset ulang.',IDEMPOTENCY_CONFLICT:'Permintaan berubah. Buat preview baru sebelum mencoba kembali.',TEMPORARY_PASSWORD_ALREADY_USED:'Password sementara sudah dipakai akun lain. Gunakan password berbeda.',REPORT_PASSPHRASE_MUST_DIFFER:'Frasa sandi laporan harus berbeda dari password sementara.',PASSWORD_MUST_DIFFER:'Password pribadi harus berbeda dari password sementara.',INITIAL_PASSWORD_REQUIRED:'Ganti password sementara sebelum mengakses fitur lain.',LOGIN_INVALID:'Identitas atau kata sandi tidak valid.',AUTH_REQUIRED:'Sesi berakhir. Silakan masuk kembali.',CHALLENGE_INVALID:'Kode salah, kedaluwarsa, atau sudah digunakan.',PASSWORD_MIN_6:'Kata sandi minimal 6 karakter.',PASSWORD_TOO_WEAK:'Kata sandi terlalu umum atau mudah ditebak. Pilih kombinasi lain.',CURRENT_PASSWORD_INVALID:'Password saat ini tidak benar.',CURRENT_PASSWORD_REQUIRED:'Masukkan password saat ini untuk mengubah email.',REPORT_PASSPHRASE_MIN_12:'Frasa sandi enkripsi laporan minimal 12 karakter.',PASSWORD_CONFIRMATION_MISMATCH:'Konfirmasi kata sandi tidak cocok.',PROFILE_FIELD_FORBIDDEN:'Identitas akademik dan role hanya dapat dikelola oleh admin.',RECENT_LOGIN_REQUIRED:'Masuk kembali untuk mengakses operasi sensitif.',VERSION_CONFLICT:'Data berubah di perangkat lain. Muat ulang sebelum menyimpan.',QR_INVALID_OR_EXPIRED:'QR tidak valid atau kedaluwarsa.',NOT_ENROLLED:'Anda tidak terdaftar pada sesi ini.',TOO_MANY_ATTEMPTS:'Terlalu banyak percobaan. Coba lagi setelah 15 menit.',MAIL_NOT_CONFIGURED:'Layanan email belum dikonfigurasi.',EXACT_SESSION_REQUIRED:'Pilih sesi dan tanggal pertemuan yang tepat.',DATA_CONFLICT:'Data memiliki relasi atau nilai yang berkonflik.'};
    throw new ApiError(response.status, code, messages[code] || result.error?.message || 'Permintaan gagal. Data belum disimpan.');
  }
  return result;
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> { return (await apiResponse(path, method, body)).data; }
export async function allPages<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  for (let page = 1; ; page++) {
    const result = await apiResponse(`${path}?page=${page}&pageSize=100`);
    values.push(...result.data);
    if (values.length >= result.meta.total || result.data.length === 0) return values;
  }
}
export async function login(identifier: string, password: string, role: string) {
  const user = await api('/auth/login', 'POST', { identifier, password, role });
  invalidateApiSession();
  window.dispatchEvent(new Event('hadir-session-changed'));
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hadir-auth'); channel?.postMessage('changed'); channel?.close();
  return user;
}
