import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { expect, afterEach } from "vitest";

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers);

afterEach(() => {
  cleanup();
});
