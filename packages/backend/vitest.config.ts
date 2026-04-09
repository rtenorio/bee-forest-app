import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load .env so DATABASE_URL is available at config parse time.
// Priority: TEST_DATABASE_URL (explicit CI/local override) → DATABASE_URL from .env → local default.
dotenv.config();

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      // Vitest sets this BEFORE config.ts is imported in the worker, so dotenv
      // inside config.ts will not override it (dotenv skips already-set vars).
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        'postgresql://beeforest:beeforest@localhost:5432/beeforest_test',
      JWT_SECRET:
        process.env.JWT_SECRET ?? 'bee-forest-test-secret-not-for-production',
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Run test files sequentially — they share the same DB.
    sequence: { concurrent: false },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // one worker process shared by all test files
      },
    },
    forceExit: true, // close the PG pool and exit cleanly after tests
  },
});
