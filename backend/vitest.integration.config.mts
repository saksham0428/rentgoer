import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/helpers/setup-integration.ts'],
    reporters: ['default'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Database integration tests run sequentially to prevent concurrency conflicts on shared state
    fileParallelism: false,
    pool: 'forks',
  },
});
