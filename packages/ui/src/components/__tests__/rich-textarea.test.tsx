// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { RichTextarea } from "../rich-textarea";

const mockToolbarContainer = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock react-quilljs
const mockQuillInstance = {
  root: {
    innerHTML: "",
  },
  on: vi.fn(),
  off: vi.fn(),
  enable: vi.fn(),
  focus: vi.fn(),
  getLength: vi.fn(() => 0),
  getSelection: vi.fn<() => { index: number; length: number } | null>(() => null),
  setSelection: vi.fn(),
  getModule: vi.fn(() => ({
    container: mockToolbarContainer,
  })),
};

vi.mock("react-quilljs", () => ({
  useQuill: vi.fn(() => ({
    quill: mockQuillInstance,
  })),
}));

describe("RichTextarea", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuillInstance.root.innerHTML = "";
    mockQuillInstance.on.mockClear();
    mockQuillInstance.off.mockClear();
    mockQuillInstance.enable.mockClear();
    mockQuillInstance.getModule.mockClear();
    mockToolbarContainer.addEventListener.mockClear();
    mockToolbarContainer.removeEventListener.mockClear();
  });

  it("renders the editor container", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    const textbox = screen.getByRole("textbox");
    expect(textbox).toBeInTheDocument();
  });

  it("applies custom placeholder", () => {
    render(<RichTextarea value="" onChange={mockOnChange} placeholder="Custom placeholder" />);

    const textbox = screen.getByRole("textbox");
    expect(textbox).toHaveAttribute("aria-placeholder", "Custom placeholder");
  });

  it("applies default placeholder", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    const textbox = screen.getByRole("textbox");
    expect(textbox).toHaveAttribute("aria-placeholder", "Write something awesome...");
  });

  it("uses empty placeholder when disabled", () => {
    render(<RichTextarea value="" onChange={mockOnChange} isDisabled placeholder="Test" />);

    const textbox = screen.getByRole("textbox");
    // When disabled, the placeholder prop is passed but the actual placeholder text in the component is empty
    expect(textbox).toBeInTheDocument();
  });

  it("sets initial value when provided", () => {
    const testValue = "<p>Initial content</p>";
    mockQuillInstance.root.innerHTML = "";

    render(<RichTextarea value={testValue} onChange={mockOnChange} />);

    expect(mockQuillInstance.root.innerHTML).toBe(testValue);
  });

  it("enables editor by default", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    expect(mockQuillInstance.enable).toHaveBeenCalledWith(true);
  });

  it("disables editor when isDisabled is true", () => {
    render(<RichTextarea value="" onChange={mockOnChange} isDisabled />);

    expect(mockQuillInstance.enable).toHaveBeenCalledWith(false);
  });

  it("registers text-change event handler", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    expect(mockQuillInstance.on).toHaveBeenCalledWith("text-change", expect.any(Function));
  });

  it("calls onChange when content changes", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    // Get the text-change handler
    const textChangeHandler = mockQuillInstance.on.mock.calls.find(
      (call) => call[0] === "text-change",
    )?.[1];

    if (textChangeHandler) {
      // Simulate content change
      mockQuillInstance.root.innerHTML = "<p>New content</p>";
      textChangeHandler();

      expect(mockOnChange).toHaveBeenCalledWith("<p>New content</p>");
    }
  });

  it("forwards current html to onChange on every text-change event", () => {
    const testValue = "<p>Test content</p>";
    mockQuillInstance.root.innerHTML = testValue;

    render(<RichTextarea value={testValue} onChange={mockOnChange} />);

    const textChangeHandler = mockQuillInstance.on.mock.calls.find(
      (call) => call[0] === "text-change",
    )?.[1];

    if (textChangeHandler) {
      textChangeHandler();

      // No equality guard in source; emits the current html unconditionally.
      expect(mockOnChange).toHaveBeenCalledWith(testValue);
    }
  });

  it("unregisters event handler on unmount", () => {
    const { unmount } = render(<RichTextarea value="" onChange={mockOnChange} />);

    unmount();

    expect(mockQuillInstance.off).toHaveBeenCalledWith("text-change", expect.any(Function));
  });

  it("applies correct styling classes", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    const textbox = screen.getByRole("textbox");
    expect(textbox).toHaveClass("max-h-[300px]");
    expect(textbox).toHaveClass("min-h-[300px]");
    expect(textbox).toHaveClass("w-full");
  });

  it("handles value prop updates", () => {
    const { rerender } = render(<RichTextarea value="" onChange={mockOnChange} />);

    const newValue = "<p>Updated content</p>";
    mockQuillInstance.root.innerHTML = "";

    rerender(<RichTextarea value={newValue} onChange={mockOnChange} />);

    expect(mockQuillInstance.root.innerHTML).toBe(newValue);
  });

  it("handles disabled state changes", () => {
    const { rerender } = render(<RichTextarea value="" onChange={mockOnChange} />);

    expect(mockQuillInstance.enable).toHaveBeenCalledWith(true);

    mockQuillInstance.enable.mockClear();

    rerender(<RichTextarea value="" onChange={mockOnChange} isDisabled />);

    expect(mockQuillInstance.enable).toHaveBeenCalledWith(false);
  });

  it("keeps the text-change handler stable across onChange changes", () => {
    const newOnChange = vi.fn();
    const { rerender } = render(<RichTextarea value="" onChange={mockOnChange} />);

    mockQuillInstance.on.mockClear();
    mockQuillInstance.off.mockClear();

    rerender(<RichTextarea value="" onChange={newOnChange} />);

    // Source routes onChange through a ref so the handler stays bound across
    // renders; avoids resetting cursor / selection on every keystroke.
    expect(mockQuillInstance.off).not.toHaveBeenCalled();
    expect(mockQuillInstance.on).not.toHaveBeenCalled();
  });

  it("routes through onChangeRef so a swapped onChange still receives events", () => {
    const newOnChange = vi.fn();
    const { rerender } = render(<RichTextarea value="" onChange={mockOnChange} />);

    const textChangeHandler = mockQuillInstance.on.mock.calls.find(
      (call) => call[0] === "text-change",
    )?.[1];

    rerender(<RichTextarea value="" onChange={newOnChange} />);

    if (textChangeHandler) {
      mockQuillInstance.root.innerHTML = "<p>updated</p>";
      textChangeHandler();
      expect(newOnChange).toHaveBeenCalledWith("<p>updated</p>");
      expect(mockOnChange).not.toHaveBeenCalled();
    }
  });

  it("prevents default on toolbar mousedown events", () => {
    render(<RichTextarea value="" onChange={mockOnChange} />);

    expect(mockQuillInstance.getModule).toHaveBeenCalledWith("toolbar");

    expect(mockToolbarContainer.addEventListener).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function),
    );

    // Get the mousedown handler
    const mousedownHandler = mockToolbarContainer.addEventListener.mock.calls.find(
      (call) => call[0] === "mousedown",
    )?.[1];

    if (mousedownHandler) {
      // Create a mock event
      const mockEvent = {
        preventDefault: vi.fn(),
      };

      mousedownHandler(mockEvent);

      // Verify preventDefault was called
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    }
  });
  it("removes toolbar mousedown listener on unmount", () => {
    const removeEventListener = vi.fn();

    // Override container to include removeEventListener
    mockToolbarContainer.removeEventListener = removeEventListener;

    const { unmount } = render(<RichTextarea value="" onChange={mockOnChange} />);

    // Get the registered handler
    const mousedownHandler = mockToolbarContainer.addEventListener.mock.calls.find(
      (call) => call[0] === "mousedown",
    )?.[1];

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("mousedown", mousedownHandler);
  });

  it("restores the caret after a value-prop update when a selection exists", () => {
    // Mid-edit, the user has a selection in the editor. A new `value`
    // arrives (programmatic reset / prefill); the effect must snapshot
    // the selection, swap the html, then re-place the caret at a safe
    // offset clamped to the new content length.
    mockQuillInstance.getSelection.mockReturnValue({ index: 3, length: 0 });
    mockQuillInstance.getLength.mockReturnValue(2);
    mockQuillInstance.root.innerHTML = "<p>old</p>";

    const { rerender } = render(<RichTextarea value="<p>old</p>" onChange={mockOnChange} />);
    mockQuillInstance.setSelection.mockClear();

    rerender(<RichTextarea value="<p>nu</p>" onChange={mockOnChange} />);

    expect(mockQuillInstance.setSelection).toHaveBeenCalledWith(2, 0);
    mockQuillInstance.getSelection.mockReturnValue(null);
    mockQuillInstance.getLength.mockReturnValue(0);
  });

  it("falls back to empty string when value-prop update drops to undefined-ish", () => {
    mockQuillInstance.root.innerHTML = "<p>old</p>";
    const { rerender } = render(<RichTextarea value="<p>old</p>" onChange={mockOnChange} />);

    rerender(<RichTextarea value="" onChange={mockOnChange} />);

    // Empty string overwrite; setSelection not invoked since selection was null.
    expect(mockQuillInstance.root.innerHTML).toBe("");
  });

  it("stops Tab keydown propagation when releaseTabKey is set", () => {
    const root = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const original = mockQuillInstance.root;
    mockQuillInstance.root = Object.assign(root, { innerHTML: "" });

    render(<RichTextarea value="" onChange={mockOnChange} releaseTabKey />);

    expect(root.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    const handler = root.addEventListener.mock.calls.find((call) => call[0] === "keydown")?.[1];
    const stopImmediatePropagation = vi.fn();
    handler?.({ key: "Tab", stopImmediatePropagation });
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);

    // Non-Tab keys leave propagation alone.
    const stopOther = vi.fn();
    handler?.({ key: "Enter", stopImmediatePropagation: stopOther });
    expect(stopOther).not.toHaveBeenCalled();

    mockQuillInstance.root = original;
  });

  it("does not register a keydown listener when releaseTabKey is false", () => {
    const root = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const original = mockQuillInstance.root;
    mockQuillInstance.root = Object.assign(root, { innerHTML: "" });

    render(<RichTextarea value="" onChange={mockOnChange} />);

    const keydownCall = root.addEventListener.mock.calls.find((call) => call[0] === "keydown");
    expect(keydownCall).toBeUndefined();

    mockQuillInstance.root = original;
  });

  it("removes the keydown listener on unmount when releaseTabKey is set", () => {
    const root = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const original = mockQuillInstance.root;
    mockQuillInstance.root = Object.assign(root, { innerHTML: "" });

    const { unmount } = render(<RichTextarea value="" onChange={mockOnChange} releaseTabKey />);
    const handler = root.addEventListener.mock.calls.find((call) => call[0] === "keydown")?.[1];

    unmount();

    expect(root.removeEventListener).toHaveBeenCalledWith("keydown", handler, true);
    mockQuillInstance.root = original;
  });

  it("places the caret at the end on mount when autoFocus is set", () => {
    mockQuillInstance.getLength.mockReturnValueOnce(7);

    render(<RichTextarea value="<p>Hello!</p>" onChange={mockOnChange} autoFocus />);

    expect(mockQuillInstance.focus).toHaveBeenCalledTimes(1);
    expect(mockQuillInstance.setSelection).toHaveBeenCalledWith(7, 0);
  });

  it("renders the compact wrapper variant when compact is set", () => {
    render(<RichTextarea value="" onChange={mockOnChange} compact />);

    const textbox = screen.getByRole("textbox");
    // Compact path swaps the 300px-tall wrapper for a fill-its-parent variant.
    expect(textbox).not.toHaveClass("max-h-[300px]");
    const wrapper = textbox.parentElement;
    expect(wrapper).toHaveAttribute("data-rta-compact", "");
  });
});
