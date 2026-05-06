import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

// CodeEditor is globally mocked in test/setup.ts (CodeMirror can't run in jsdom)

// jsdom does not implement navigator.clipboard — provide a minimal stub so
// handleCopy() resolves instead of throwing.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

const defaults = { value: "# Sample\nprint('Hello')", language: "python" as const };

describe("MacroCodeViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("renders the editor with correct content, language, and code stats", () => {
    const code = "# Line 1\n# Line 2\n# Line 3";
    render(<MacroCodeViewer value={code} language="javascript" />);

    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "javascript");
    expect(screen.getByTestId("code-editor-textarea")).toHaveValue(code);
    const matches = screen.getAllByText(
      (_content, el) =>
        el instanceof HTMLDivElement &&
        el.classList.contains("text-xs") &&
        el.textContent.includes("3") === true &&
        el.textContent.includes("common.lines") === true,
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("copies code to clipboard", async () => {
    render(<MacroCodeViewer value="# Test" language="python" />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const button = screen.getAllByRole("button")[0];
    expect(button.querySelector(".lucide-copy")).toBeInTheDocument();
    await user.click(button);
    await waitFor(() => {
      expect(button.querySelector(".lucide-check")).toBeInTheDocument();
    });
  });

  it("applies custom height", () => {
    render(<MacroCodeViewer {...defaults} height="800px" />);
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-height", "800px");
  });
});
