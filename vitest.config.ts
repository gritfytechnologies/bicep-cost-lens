import { defineConfig } from 'vitest/config';

// The ≥80% gate (per extension-standards §4) applies to the pure logic:
// parser, cost math, API client/mapper, cache, and the estimate orchestrator.
// The VS Code shell (commands, hover wiring, config, status bar) is covered
// by the headless e2e suite instead of unit tests.
const PURE_LOGIC = [
  'src/parser.ts',
  'src/costEstimator.ts',
  'src/priceMap.ts',
  'src/pricesClient.ts',
  'src/cache.ts',
  'src/estimator.ts',
];

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: PURE_LOGIC,
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
});
