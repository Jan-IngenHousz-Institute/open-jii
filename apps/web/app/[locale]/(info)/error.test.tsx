import { render, screen } from "@/test/test-utils";
import posthog from "posthog-js";
import { describe, it, expect } from "vitest";

import InfoError from "./error";

describe("InfoError", () => {
  it("renders the maintenance page", () => {
    render(<InfoError error={new Error("boom")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/we'll be back soon/i);
  });

  it("reports the error it caught to PostHog, since nothing else would", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    render(<InfoError error={error} />);

    expect(posthog.captureException).toHaveBeenCalledWith(error, {
      boundary: "info",
      digest: "abc123",
    });
  });
});
