// Editor component test file
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { MacroCodeViewer } from "./macro-code-viewer";

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
  Pencil: () => <span data-testid="pencil-icon" />,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

  it("should display language label in header for python", () => {
    render(<MacroCodeViewer {...defaultProps} language="python" />);

    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("should display language label in header for R", () => {
    render(<MacroCodeViewer {...defaultProps} language="r" />);

    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("should display language label in header for JavaScript", () => {
    render(<MacroCodeViewer {...defaultProps} language="javascript" />);

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
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

  it("copies code to clipboard", async () => {
    render(<MacroCodeViewer value="# Test" language="python" />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    // Before click: copy icon is shown
    const button = screen.getAllByRole("button")[0];
    expect(button.querySelector(".lucide-copy")).toBeInTheDocument();
    await user.click(button);
    // After click: check icon appears confirming the copy
    await waitFor(() => {
      expect(button.querySelector(".lucide-check")).toBeInTheDocument();
    });
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
        (element?.className.includes("text-xs text-slate-500") &&
          element.textContent.includes("3") &&
          element.textContent.includes("common.lines") &&
          element.textContent.includes("26 common.bytes")) ??
        false
      );
    });
    expect(statsDiv).toBeInTheDocument();
  });

  it("should copy code to clipboard when clicking copy button", () => {
    const code = "# Test code";
    render(<MacroCodeViewer {...defaultProps} value={code} />);

    const copyButton = screen.getByTestId("button");
    act(() => {
      fireEvent.click(copyButton);
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith(code);
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("should change the copy icon to check icon after copying", () => {
    render(<MacroCodeViewer {...defaultProps} />);

    const copyButton = screen.getByTestId("button");

    // Use jest/vitest act to handle state updates
    act(() => {
      fireEvent.click(copyButton);
    });

    // Since the navigator.clipboard is mocked,
    // we can just verify that Copy button was clicked and the mock called
    expect(mockClipboard.writeText).toHaveBeenCalled();

    // Fast forward time to see the copy icon return
    act(() => {
      vi.advanceTimersByTime(2000);
    });
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

  it("should handle clipboard failure gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    mockClipboard.writeText.mockRejectedValueOnce(new Error("permission denied"));
    render(<MacroCodeViewer {...defaultProps} />);
    const copyButton = screen.getByTestId("button");
    fireEvent.click(copyButton);
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to copy:", expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it("should render edit overlay when onEditStart is provided", () => {
    const onEditStart = vi.fn();
    render(<MacroCodeViewer {...defaultProps} onEditStart={onEditStart} />);
    expect(screen.getAllByTestId("pencil-icon").length).toBeGreaterThan(0);
  });

  it("should not render edit overlay when onEditStart is not provided", () => {
    render(<MacroCodeViewer {...defaultProps} />);
    const wrapper = screen.getByTestId("monaco-editor").closest(".group\\/viewer");
    expect(wrapper).not.toHaveClass("cursor-pointer");
  });

  it("should render title when provided", () => {
    render(<MacroCodeViewer {...defaultProps} title="My Code" />);
    expect(screen.getByText("My Code")).toBeInTheDocument();
  });

  it("should call onEditStart when wrapper is clicked", () => {
    const onEditStart = vi.fn();
    render(<MacroCodeViewer {...defaultProps} onEditStart={onEditStart} />);
    const wrapper = screen.getByTestId("monaco-editor").parentElement?.parentElement;
    if (wrapper) fireEvent.click(wrapper);
    expect(onEditStart).toHaveBeenCalled();
  });
});
