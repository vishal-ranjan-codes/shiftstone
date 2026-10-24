import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.ts',
      'harness/**/__tests__/**/*.test.ts',
      'packs/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    // LOCK-A4: the default threads pool drops worker RPC calls on Windows under
    // load, surfacing as `[vitest-worker] Timeout calling "onTaskUpdate"` after
    // every test has already passed. Forked processes are heavier but reliable.
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 4,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
