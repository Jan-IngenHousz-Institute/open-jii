import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { CopyButton } from "../copy-button";

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
});

describe("CopyButton", () => {
  it("puts the value on the clipboard", async () => {
    render(<CopyButton value="greenhouse-gw-01" label="Copy" copiedLabel="Copied" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("greenhouse-gw-01");
    });
  });

  it("confirms in place, then reverts", async () => {
    vi.useFakeTimers();
    render(<CopyButton value="abc" label="Copy" copiedLabel="Copied" resetDelay={2000} />);

    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
    vi.useRealTimers();
  });

  it("stays quiet when the clipboard is blocked", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyButton value="abc" label="Copy" copiedLabel="Copied" />);

    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
    });

    // No confirmed state, and no thrown error: the value is still selectable.
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
  });
});
