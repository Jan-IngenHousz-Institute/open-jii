import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import InfoError from "./error";

describe("InfoError", () => {
  it("renders the maintenance page", () => {
    render(<InfoError error={new Error("boom")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
  });
});
