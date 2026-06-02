import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Run after each test to reset the DOM between cases.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
