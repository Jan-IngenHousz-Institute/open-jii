import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";

import NotFoundCatchAll from "./page";

// --- Mocks ---
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: (): unknown => mockNotFound(),
}));

// --- Tests ---
describe("BlogNotFoundCatchAll", () => {
  it("calls notFound function when executed", () => {
    mockNotFound.mockImplementation(() => {
      const error = new Error("NEXT_NOT_FOUND");
      error.name = "NotFoundError";
      throw error;
    });

    expect(() => NotFoundCatchAll()).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("is a function component", () => {
    expect(typeof NotFoundCatchAll).toBe("function");
  });
});
