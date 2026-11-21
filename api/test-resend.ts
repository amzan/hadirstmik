export default function handler(_req: any, res: any) { return res.status(410).json({ error: { code: 'ENDPOINT_RETIRED', message: 'Gunakan API autentikasi Hadir STMIK.' } }); }
