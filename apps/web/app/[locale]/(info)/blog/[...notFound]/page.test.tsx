import { notFound } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import NotFoundCatchAll from "./page";

describe("BlogNotFoundCatchAll", () => {
  it("calls notFound()", () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    expect(() => NotFoundCatchAll()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
