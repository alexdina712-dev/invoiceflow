import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig(({ command }) => ({
  // CI/dev .env values must never ship React's development runtime.
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  plugins: [react()],
  server: { port: 5175, proxy: { '/api': 'http://127.0.0.1:4002' } },
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
}));
