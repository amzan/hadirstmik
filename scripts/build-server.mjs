import { build } from 'esbuild';
await build({ entryPoints: ['server.ts'], outfile: 'server.mjs', platform: 'node', target: 'node24', format: 'esm', bundle: true, packages: 'external', sourcemap: false });
