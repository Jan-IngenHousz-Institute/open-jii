import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  Editor: ({ value, language, theme }: { value: string; language?: string; theme?: string }) => (
    <div data-testid="monaco-editor" data-language={language} data-theme={theme}>
      <div data-testid="editor-value">{value}</div>
    </div>
  ),
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(global.navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
});

describe("MacroCodeViewer", () => {
  const defaultProps = {
    value: "# Sample code\nprint('Hello world')",
    language: "python" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the editor container", () => {
    render(<MacroCodeViewer {...defaultProps} />);

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
