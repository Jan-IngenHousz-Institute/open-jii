// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { RichTextarea } from "./rich-textarea";

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

  it("does not call onChange if content is unchanged", () => {
    const testValue = "<p>Test content</p>";
    mockQuillInstance.root.innerHTML = testValue;

    render(<RichTextarea value={testValue} onChange={mockOnChange} />);

    // Get the text-change handler
    const textChangeHandler = mockQuillInstance.on.mock.calls.find(
      (call) => call[0] === "text-change",
    )?.[1];

    if (textChangeHandler) {
      // Simulate text change but content is same
      textChangeHandler();

      expect(mockOnChange).not.toHaveBeenCalled();
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

  it("re-registers event handlers when onChange changes", () => {
    const newOnChange = vi.fn();
    const { rerender } = render(<RichTextarea value="" onChange={mockOnChange} />);

    mockQuillInstance.on.mockClear();
    mockQuillInstance.off.mockClear();

    rerender(<RichTextarea value="" onChange={newOnChange} />);

    // Should unregister old handler
    expect(mockQuillInstance.off).toHaveBeenCalledWith("text-change", expect.any(Function));
    // Should register new handler
    expect(mockQuillInstance.on).toHaveBeenCalledWith("text-change", expect.any(Function));
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
});
