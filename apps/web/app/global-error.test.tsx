import { render, screen } from "@/test/test-utils";
import posthog from "posthog-js";
import { describe, it, expect } from "vitest";

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("renders the maintenance page", () => {
    render(<GlobalError error={new Error("boom")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
  });

  it("reports the error it caught to PostHog, since nothing else would", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    render(<GlobalError error={error} />);

    expect(posthog.captureException).toHaveBeenCalledWith(error, {
      boundary: "global",
      digest: "abc123",
    });
  });
});
