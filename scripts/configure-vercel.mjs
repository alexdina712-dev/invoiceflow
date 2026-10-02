import { writeFileSync } from 'node:fs';
const backend = process.argv[2];
if (!backend || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(backend))
  throw new Error('Usage: node scripts/configure-vercel.mjs https://your-api.onrender.com');
const config = {
  framework: 'vite',
  installCommand: 'pnpm install --frozen-lockfile',
  buildCommand: 'pnpm db:generate && pnpm build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend}/api/:path*` },
    { source: '/((?!api/).*)', destination: '/index.html' },
  ],
  headers: [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
};
writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log('Wrote vercel.json for ' + backend);
