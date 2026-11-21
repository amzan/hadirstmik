import mysql from 'mysql2/promise';
import { localDatabase, requireValue } from './security.mjs';

export function databaseConfig(env = process.env) {
  const config = { host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
  requireValue(config.host && config.database && config.user && Number.isInteger(config.port), 'DATABASE_NOT_CONFIGURED', 503);
  if (env.NODE_ENV !== 'production') localDatabase(config);
  return config;
}
export function createPool(env = process.env) {
  return mysql.createPool({ ...databaseConfig(env), connectionLimit: 5, queueLimit: 20, waitForConnections: true, timezone: 'Z', dateStrings: ['DATE'], multipleStatements: false, charset: 'utf8mb4' });
}
export async function transaction(pool, work) {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function rows(db, sql, values = []) { const [result] = await db.execute(sql, values); return result; }
export async function audit(db, actor, action, entity, id) {
  await rows(db, 'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [actor, action, entity, id]);
}
