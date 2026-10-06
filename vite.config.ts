import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function vercelPortalAdminPlugin(): Plugin {
  return {
    name: 'vercel-portal-admin-copy',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        const portalDir = path.join(distDir, 'portaladmin');
        if (!fs.existsSync(portalDir)) {
          fs.mkdirSync(portalDir, { recursive: true });
        }
        fs.copyFileSync(indexPath, path.join(portalDir, 'index.html'));
        fs.copyFileSync(indexPath, path.join(distDir, 'portaladmin.html'));
        console.log('✓ Generated dist/portaladmin/index.html & dist/portaladmin.html for Vercel SPA routing');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercelPortalAdminPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
