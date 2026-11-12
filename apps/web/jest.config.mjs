import nextJest from 'next/jest.js';

// Uses Next's own compiler and resolves the "@/..." alias like the app does
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
export default createJestConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // The web app may have no test yet: that is not a failure
  passWithNoTests: true,
});
