import { jest } from "@jest/globals";

// Import this first in a test file: it must run before any module that
// uses next/navigation is loaded (Next's test compiler does not move
// jest.mock calls to the top of the file).
export const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));
