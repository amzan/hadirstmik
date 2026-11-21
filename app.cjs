if (process.env.HADIR_CONFIG_PATH) {
  Object.assign(process.env, JSON.parse(require('node:fs').readFileSync(process.env.HADIR_CONFIG_PATH, 'utf8')));
}
import('./server.mjs').catch((error) => {
  console.error('Gagal menjalankan Hadir STMIK:', error);
  process.exitCode = 1;
});
