import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import React from "react";
import { expect, afterEach } from "vitest";

// Make React globally available for JSX in tests
globalThis.React = React;

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
