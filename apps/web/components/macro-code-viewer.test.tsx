import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

vi.mock("@monaco-editor/react", () => ({
  Editor: ({ value, language, theme }: { value: string; language?: string; theme?: string }) => (
    <div data-testid="monaco-editor" data-language={language} data-theme={theme}>
      <div data-testid="editor-value">{value}</div>
    </div>
  ),
}));

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

  it("renders the editor", () => {
    render(<MacroCodeViewer {...defaults} />);
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
  });

  it("maps javascript to typescript in Monaco", () => {
    render(<MacroCodeViewer {...defaults} language="javascript" />);
    expect(screen.getByTestId("monaco-editor")).toHaveAttribute("data-language", "typescript");
  });

  it("shows content in the editor", () => {
    render(<MacroCodeViewer {...defaults} />);
    const value = screen.getByTestId("editor-value");
    expect(value).toHaveTextContent("# Sample");
    expect(value).toHaveTextContent("print('Hello')");
  });

  it("should render copy button", () => {
    render(<MacroCodeViewer {...defaultProps} />);

    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  it("should use python language in editor", () => {
    render(<MacroCodeViewer {...defaultProps} language="python" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("applies custom height", () => {
    render(<MacroCodeViewer {...defaults} height="800px" />);
    expect(screen.getByTestId("monaco-editor").parentElement).toHaveStyle({ height: "800px" });
  });
});
