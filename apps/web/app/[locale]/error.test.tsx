import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import LocaleError from "./error";

describe("LocaleError", () => {
  it("renders the maintenance page", () => {
    render(<LocaleError error={new Error("boom")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
  });
});
