import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

vi.mock("@monaco-editor/react", () => ({
  Editor: ({ value, language, theme }: { value: string; language?: string; theme?: string }) => (
    <div data-testid="monaco-editor" data-language={language} data-theme={theme}>
      <div data-testid="editor-value">{value}</div>
    </div>
  ),
}));

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

const defaults = { value: "# Sample\nprint('Hello')", language: "python" as const };

describe("MacroCodeViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("renders the editor", () => {
    render(<MacroCodeViewer {...defaults} />);
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
  });

  it.each([
    ["python", "test_macro.py"],
    ["r", "test_macro.R"],
    ["javascript", "test_macro.js"],
  ] as const)("displays correct filename for %s", (language, expected) => {
    render(<MacroCodeViewer {...defaults} language={language} macroName="Test Macro" />);
    expect(screen.getByText(expected)).toBeInTheDocument();
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

  it("displays code statistics", () => {
    render(<MacroCodeViewer value="# 1\n# 2\n# 3" language="python" />);
    // Stats div contains line count and "common.lines" text
    const matches = screen.getAllByText(
      (_content, el) =>
        el instanceof HTMLDivElement &&
        el.classList.contains("text-xs") &&
        el.textContent.includes("3") === true &&
        el.textContent.includes("common.lines") === true,
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("copies code to clipboard", () => {
    render(<MacroCodeViewer value="# Test" language="python" />);
    screen.getAllByRole("button")[0].click();
    expect(mockWriteText).toHaveBeenCalledWith("# Test");
  });

  it("applies custom height", () => {
    render(<MacroCodeViewer {...defaults} height="800px" />);
    expect(screen.getByTestId("monaco-editor").parentElement).toHaveStyle({ height: "800px" });
  });
});
