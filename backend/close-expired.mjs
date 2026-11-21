import { createPool } from './database.mjs';
import { expireSessions } from './domain.mjs';
const pool = createPool();
try { await expireSessions(pool); console.log('Expired attendance sessions processed.'); }
catch { console.error('CLOSE_EXPIRED_FAILED'); process.exitCode = 1; }
finally { await pool.end(); }
