// Unit tests: src/**/*.spec.ts. The e2e tests run on Vitest
// (vitest.config.e2e.ts) against a real database.
//
// Nest 12 ships as ESM only, so Jest runs in ESM mode: the npm scripts set
// --experimental-vm-modules, and mocks come from `import { jest } from
// '@jest/globals'` instead of a global.

/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  // Sources import siblings as "./file.js" (Node ESM); Jest resolves the .ts
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/generated/**',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
};
