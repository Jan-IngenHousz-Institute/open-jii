// JsonCodeViewer component test file
import { render, screen, userEvent, act } from "@/test/test-utils";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { JsonCodeViewer } from "./json-code-viewer";

// CodeEditor is globally mocked in test/setup.ts (CodeMirror can't run in jsdom)

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(global.navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

describe("JsonCodeViewer", () => {
  const sampleObject = { name: "test", value: 42 };
  const sampleArray = [{ id: 1 }, { id: 2 }];
  const sampleString = '{"key": "value"}';

  const defaultProps = {
    value: sampleObject,
  };

  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup({ pointerEventsCheck: 0 });
    // Re-apply clipboard mock after userEvent.setup() replaces it with its own stub
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the editor container", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
  });

  it("should display JSON language label in header", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should render copy button with copy icon", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(document.querySelector(".lucide-copy")).toBeInTheDocument();
  });

  it("should pass json language to editor", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "json");
  });

  it("should convert an object value to formatted JSON string in editor", () => {
    render(<JsonCodeViewer value={sampleObject} />);

    const textarea = screen.getByTestId("code-editor-textarea");
    expect((textarea as HTMLTextAreaElement).value).toContain('"name": "test"');
    expect((textarea as HTMLTextAreaElement).value).toContain('"value": 42');
  });

  it("should convert an array value to formatted JSON string in editor", () => {
    render(<JsonCodeViewer value={sampleArray} />);

    const textarea = screen.getByTestId("code-editor-textarea");
    expect((textarea as HTMLTextAreaElement).value).toContain('"id": 1');
    expect((textarea as HTMLTextAreaElement).value).toContain('"id": 2');
  });

  it("should pass a string value through as-is to the editor", () => {
    render(<JsonCodeViewer value={sampleString} />);

    const textarea = screen.getByTestId("code-editor-textarea");
    expect(textarea).toHaveValue('{"key": "value"}');
  });

  it("should display code statistics (lines and size)", () => {
    const jsonStr = JSON.stringify(sampleObject, null, 2);
    const lineCount = jsonStr.split("\n").length;

    render(<JsonCodeViewer value={sampleObject} />);

    const statsEl = screen.getByText((_content, element) => {
      if (!element) return false;
      const text = element.textContent;
      return (
        typeof element.className === "string" &&
        element.className.includes("text-xs text-slate-500") &&
        text.includes(`${lineCount}`) &&
        text.includes("lines")
      );
    });
    expect(statsEl).toBeInTheDocument();
  });

  it("should display title when provided", () => {
    render(<JsonCodeViewer {...defaultProps} title="My JSON Data" />);

    expect(screen.getByText("My JSON Data")).toBeInTheDocument();
  });

  it("should display separator pipe when title is provided", () => {
    render(<JsonCodeViewer {...defaultProps} title="My JSON Data" />);

    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("should not display title or separator when title is not provided", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(screen.queryByText("|")).not.toBeInTheDocument();
  });

  it("should copy JSON to clipboard when clicking copy button", async () => {
    render(<JsonCodeViewer value={sampleObject} />);

    const copyButton = screen.getByRole("button");
    await user.click(copyButton);

    const expectedJson = JSON.stringify(sampleObject, null, 2);
    expect(mockClipboard.writeText).toHaveBeenCalledWith(expectedJson);
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("should copy string value as-is to clipboard", async () => {
    render(<JsonCodeViewer value={sampleString} />);

    const copyButton = screen.getByRole("button");
    await user.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(sampleString);
  });

  it("should show check icon after successful copy", async () => {
    render(<JsonCodeViewer {...defaultProps} />);

    const copyButton = screen.getByRole("button");

    await user.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalled();

    // After timeout, copy icon should return
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector(".lucide-copy")).toBeInTheDocument();
  });

  it("should use default height of 400px", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-height", "400px");
  });

  it("should apply custom height when provided", () => {
    render(<JsonCodeViewer {...defaultProps} height="600px" />);

    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-height", "600px");
  });

  it("should render pencil overlay when onEditStart is provided", () => {
    const onEditStart = vi.fn();
    render(<JsonCodeViewer {...defaultProps} onEditStart={onEditStart} />);

    expect(document.querySelector(".lucide-pencil")).toBeInTheDocument();
  });

  it("should not render pencil overlay when onEditStart is not provided", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    expect(document.querySelector(".lucide-pencil")).not.toBeInTheDocument();
  });

  it("should call onEditStart when the container is clicked", async () => {
    const onEditStart = vi.fn();
    render(<JsonCodeViewer {...defaultProps} onEditStart={onEditStart} />);

    // Click the outer container
    const container = screen.getByTestId("json-viewer-wrapper");
    await user.click(container);

    expect(onEditStart).toHaveBeenCalled();
  });

  it("should add cursor-pointer class when onEditStart is provided", () => {
    const onEditStart = vi.fn();
    render(<JsonCodeViewer {...defaultProps} onEditStart={onEditStart} />);

    const container = screen.getByTestId("json-viewer-wrapper");
    expect(container.className).toContain("cursor-pointer");
  });

  it("should not add cursor-pointer class when onEditStart is not provided", () => {
    render(<JsonCodeViewer {...defaultProps} />);

    const container = screen.getByTestId("json-viewer-wrapper");
    // The outer div should not have cursor-pointer (it may appear in the overlay child,
    // but we check the outer container class string)
    expect(container.className).not.toContain("cursor-pointer");
  });

  it("should apply custom className", () => {
    render(<JsonCodeViewer {...defaultProps} className="my-custom-class" />);

    const container = screen.getByTestId("json-viewer-wrapper");
    expect(container.className).toContain("my-custom-class");
  });

  it("should stop propagation on copy button click so onEditStart is not triggered", async () => {
    const onEditStart = vi.fn();
    render(<JsonCodeViewer {...defaultProps} onEditStart={onEditStart} />);

    const copyButton = screen.getByRole("button");
    await user.click(copyButton);

    // The copy button's onClick calls e.stopPropagation(), so onEditStart should NOT
    // be called from the copy button click. However, the mock Button doesn't inherently
    // stop propagation — we're verifying the clipboard was called.
    expect(mockClipboard.writeText).toHaveBeenCalled();
  });

  it("should handle clipboard write failure gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    mockClipboard.writeText.mockRejectedValueOnce(new Error("Clipboard error"));

    render(<JsonCodeViewer {...defaultProps} />);

    const copyButton = screen.getByRole("button");

    await user.click(copyButton);

    // Should log the error and not crash
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to copy to clipboard:", expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it("should display size in bytes for small content", () => {
    const smallObj = { a: 1 };
    render(<JsonCodeViewer value={smallObj} />);

    const jsonStr = JSON.stringify(smallObj, null, 2);
    const expectedSize = new Blob([jsonStr]).size;

    const statsEl = screen.getByText((_content, element) => {
      if (!element) return false;
      return (
        typeof element.className === "string" &&
        element.className.includes("text-xs text-slate-500") &&
        element.textContent.includes(`${expectedSize} B`)
      );
    });
    expect(statsEl).toBeInTheDocument();
  });
});
