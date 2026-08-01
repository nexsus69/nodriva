import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    resolve: {
      alias: {
        'next/server': path.resolve(__dirname, 'node_modules/next/server.js'),
      },
    },
    test: {
      environment: 'node',
      env,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});
