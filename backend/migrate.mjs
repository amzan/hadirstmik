import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createPool, databaseConfig, rows } from './database.mjs';
import { localDatabase, requireValue } from './security.mjs';

export async function migrate(pool, directory = new URL('./migrations/', import.meta.url)) {
  const connection = await pool.getConnection();
  try {
    const [lock] = await rows(connection, "SELECT GET_LOCK('hadir_schema_migrations',5) AS acquired"); requireValue(lock.acquired === 1, 'MIGRATION_BUSY');
    await rows(connection, 'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(200) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const files = (await readdir(directory)).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8'), checksum = createHash('sha256').update(sql).digest('hex');
      const [prior] = await rows(connection, 'SELECT checksum FROM schema_migrations WHERE name=?', [file]);
      if (prior) { requireValue(prior.checksum === checksum, 'MIGRATION_CHECKSUM_MISMATCH'); continue; }
      const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
      for (const statement of statements) {
        const constraint = statement.match(/^ALTER TABLE (\w+) ADD CONSTRAINT (\w+)/i);
        if (constraint && (await rows(connection, 'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?', [constraint[1], constraint[2]])).length) continue;
        await connection.query(statement);
      }
      await rows(connection, 'INSERT INTO schema_migrations (name,checksum) VALUES (?,?)', [file, checksum]);
    }
  } finally { await rows(connection, "SELECT RELEASE_LOCK('hadir_schema_migrations')"); connection.release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { requireValue(process.argv.includes('--local'), 'EXPLICIT_LOCAL_FLAG_REQUIRED'); localDatabase(databaseConfig()); const pool = createPool(); try { await migrate(pool); console.log('Local migrations applied.'); } finally { await pool.end(); } }
  catch (error) { console.error(error.code || 'MIGRATION_FAILED'); process.exitCode = 1; }
}
