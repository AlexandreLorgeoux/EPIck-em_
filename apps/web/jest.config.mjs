import nextJest from "next/jest.js";

// Uses Next's own compiler and resolves the "@/..." alias like the app does
const createJestConfig = nextJest({ dir: "./" });

// Packages published only as ES modules, which Jest must compile too
const esmPackages = ["jose"];

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  // Component tests (.tsx) pick jsdom with a @jest-environment comment
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  // The web app may have no test yet: that is not a failure
  passWithNoTests: true,
};

const jestConfig = async () => {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    // next/jest skips every node_modules package; let the ESM-only ones in
    transformIgnorePatterns: [
      `/node_modules/(?!(${esmPackages.join("|")})/)`,
      ...resolved.transformIgnorePatterns.filter(
        (pattern) => !pattern.includes("node_modules"),
      ),
    ],
  };
};

export default jestConfig;
