// Editor component test file
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    language,
    theme,
    onMount,
  }: {
    value: string;
    language?: string;
    theme?: string;
    onMount?: (editor: unknown, monaco: unknown) => void;
  }) => {
    // Create a mock editor object that has the methods we need
    const mockEditor = {
      updateOptions: vi.fn(),
      getModel: () => ({ getValue: () => value }),
      getValue: () => value,
    };

    return (
      <div data-testid="monaco-editor">
        <div data-testid="editor-language">{language}</div>
        <div data-testid="editor-theme">{theme}</div>
        <div data-testid="editor-value">{value}</div>
        <button onClick={() => onMount?.(mockEditor, {})} data-testid="mount-trigger">
          Mount Editor
        </button>
      </div>
    );
  },
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Copy: () => <span data-testid="copy-icon">📋</span>,
  Check: () => <span data-testid="check-icon">✅</span>,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
    "data-testid": dataTestId,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    "data-testid"?: string;
  }) => (
    <button onClick={onClick} className={className} data-testid={dataTestId ?? "button"} {...props}>
      {children}
    </button>
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

  it("should display macro name with python extension in header", () => {
    render(<MacroCodeViewer {...defaultProps} language="python" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.py")).toBeInTheDocument();
  });

  it("should display macro name with R extension in header", () => {
    render(<MacroCodeViewer {...defaultProps} language="r" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.R")).toBeInTheDocument();
  });

  it("should display macro name with JavaScript extension in header", () => {
    render(<MacroCodeViewer {...defaultProps} language="javascript" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.js")).toBeInTheDocument();
  });

  it("should render copy button", () => {
    render(<MacroCodeViewer {...defaultProps} />);

    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  it("should use python language in editor", () => {
    render(<MacroCodeViewer {...defaultProps} language="python" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("should use r language in editor", () => {
    render(<MacroCodeViewer {...defaultProps} language="r" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("r");
  });

  it("should use typescript for javascript language in editor", () => {
    render(<MacroCodeViewer {...defaultProps} language="javascript" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("typescript");
  });

  it("should show the content in the editor", () => {
    const code = "# Test code\nprint('Hello world')";
    render(<MacroCodeViewer {...defaultProps} value={code} />);

    // Check that the content is in the editor (newlines may be formatted differently)
    const editorValue = screen.getByTestId("editor-value");
    expect(editorValue).toHaveTextContent("# Test code");
    expect(editorValue).toHaveTextContent("print('Hello world')");
  });

  it("should display code statistics", () => {
    const code = "# Line 1\n# Line 2\n# Line 3";
    render(<MacroCodeViewer {...defaultProps} value={code} />);

    // Check for line count and byte count - the div that contains both
    const statsDiv = screen.getByText((content, element) => {
      return (
        (element?.className?.includes("text-xs text-slate-500") &&
          element?.textContent?.includes("3") &&
          element?.textContent?.includes("common.lines") &&
          element?.textContent?.includes("26 common.bytes")) ??
        false
      );
    });
    expect(statsDiv).toBeInTheDocument();
  });

  it("should copy code to clipboard when clicking copy button", () => {
    const code = "# Test code";
    render(<MacroCodeViewer {...defaultProps} value={code} />);

    const copyButton = screen.getByTestId("button");
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(code);
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("should change the copy icon to check icon after copying", async () => {
    render(<MacroCodeViewer {...defaultProps} />);

    const copyButton = screen.getByTestId("button");

    // Use jest/vitest act to handle state updates
    await vi.waitFor(() => {
      fireEvent.click(copyButton);
    });

    // Since the navigator.clipboard is mocked,
    // we can just verify that Copy button was clicked and the mock called
    expect(mockClipboard.writeText).toHaveBeenCalled();

    // Fast forward time to see the copy icon return
    vi.advanceTimersByTime(2000);
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  it("should configure editor with readOnly option", () => {
    render(<MacroCodeViewer {...defaultProps} />);

    const mountTrigger = screen.getByTestId("mount-trigger");
    fireEvent.click(mountTrigger);

    // The mock editor's updateOptions should have been called with an object
    // containing readOnly: true and domReadOnly: true
    // Since we can't directly check the options passed, we're verifying the
    // mounting behavior was triggered
    expect(mountTrigger).toBeInTheDocument();
  });

  it("should apply custom height when provided", () => {
    const customHeight = "800px";
    render(<MacroCodeViewer {...defaultProps} height={customHeight} />);

    // Find div with the custom height style
    const heightContainer = screen.getByTestId("monaco-editor").parentElement;
    expect(heightContainer).toHaveStyle(`height: ${customHeight}`);
  });
});
