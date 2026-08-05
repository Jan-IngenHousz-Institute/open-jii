import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { AutosaveIndicator } from "./autosave-indicator";

describe("AutosaveIndicator", () => {
  it("exposes an actionable retry for a failed save", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AutosaveIndicator status="error" variant="full" onRetry={retry} />);

    await user.click(screen.getByRole("button", { name: "tryAgain" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps the compact retry accessible", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AutosaveIndicator status="error" variant="compact" onRetry={retry} />);

    await user.click(screen.getByRole("button", { name: /tryAgain/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
