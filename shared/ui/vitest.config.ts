import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // tsconfigPaths() reads the `@ledger/utils` alias from tsconfig.json
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // enables RTL's automatic unmount/cleanup between tests via afterEach
    globals: true,
  },
});
