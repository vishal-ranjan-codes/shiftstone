import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.ts',
      'harness/**/__tests__/**/*.test.ts',
      '../packs/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
