import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("renders the maintenance page", () => {
    render(<GlobalError error={new Error("boom")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
  });
});
