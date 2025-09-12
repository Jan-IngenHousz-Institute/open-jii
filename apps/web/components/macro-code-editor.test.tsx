// Editor component test file
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import MacroCodeEditor from "./macro-code-editor";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange,
    language,
    theme,
    onMount,
  }: {
    value: string;
    onChange: (value: string) => void;
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
        <textarea
          data-testid="editor-textarea"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        />
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
  Label: ({ children }: { children: React.ReactNode }) => (
    <label data-testid="label">{children}</label>
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

describe("MacroCodeEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    language: "python" as const,
    macroName: "test_macro",
    username: "test_user",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the editor container", () => {
    render(<MacroCodeEditor {...defaultProps} />);

    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
  });

  it("should render label when provided", () => {
    render(<MacroCodeEditor {...defaultProps} label="Code Editor" />);

    expect(screen.getByTestId("label")).toBeInTheDocument();
    expect(screen.getByText("Code Editor")).toBeInTheDocument();
  });

  it("should display macro name with python extension in header", () => {
    render(<MacroCodeEditor {...defaultProps} language="python" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.py")).toBeInTheDocument();
  });

  it("should display macro name with R extension in header", () => {
    render(<MacroCodeEditor {...defaultProps} language="r" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.R")).toBeInTheDocument();
  });

  it("should display macro name with JavaScript extension in header", () => {
    render(<MacroCodeEditor {...defaultProps} language="javascript" macroName="Test Macro" />);

    expect(screen.getByText("test_macro.js")).toBeInTheDocument();
  });

  it("should render copy button", () => {
    render(<MacroCodeEditor {...defaultProps} />);

    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  it("should call onChange when editor value changes", () => {
    const mockOnChange = vi.fn();
    render(<MacroCodeEditor {...defaultProps} onChange={mockOnChange} />);

    const textarea = screen.getByTestId("editor-textarea");
    fireEvent.change(textarea, { target: { value: "new code" } });

    expect(mockOnChange).toHaveBeenCalledWith("new code");
  });

  it("should use python language in editor", () => {
    render(<MacroCodeEditor {...defaultProps} language="python" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("should use r language in editor", () => {
    render(<MacroCodeEditor {...defaultProps} language="r" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("r");
  });

  it("should use typescript for javascript language", () => {
    render(<MacroCodeEditor {...defaultProps} language="javascript" />);

    expect(screen.getByTestId("editor-language")).toHaveTextContent("typescript");
  });

  it("should use vs theme", () => {
    render(<MacroCodeEditor {...defaultProps} />);

    expect(screen.getByTestId("editor-theme")).toHaveTextContent("vs");
  });

  it("should handle editor value changes", () => {
    const mockOnChange = vi.fn();
    render(<MacroCodeEditor {...defaultProps} onChange={mockOnChange} />);

    const textarea = screen.getByTestId("editor-textarea");
    fireEvent.change(textarea, { target: { value: "test code" } });

    expect(mockOnChange).toHaveBeenCalledWith("test code");
  });

  it("should use provided value when not empty", () => {
    render(<MacroCodeEditor {...defaultProps} value="custom code" />);

    const textarea = screen.getByTestId("editor-textarea");
    expect(textarea).toHaveValue("custom code");
  });

  it("should apply custom height when provided", () => {
    render(<MacroCodeEditor {...defaultProps} height="500px" />);

    const container = screen.getByTestId("monaco-editor").parentElement;
    expect(container).toHaveStyle({ height: "500px" });
  });

  it("should use default height when not specified", () => {
    render(<MacroCodeEditor {...defaultProps} />);

    const container = screen.getByTestId("monaco-editor").parentElement;
    expect(container).toHaveStyle({ height: "400px" });
  });

  it("should display error message when error prop is provided", () => {
    render(<MacroCodeEditor {...defaultProps} error="Test error message" />);

    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("should handle editor mount callback", () => {
    const mockOnChange = vi.fn();
    render(<MacroCodeEditor value="test" onChange={mockOnChange} language="python" />);

    // Simulate editor mount
    const mountButton = screen.getByTestId("mount-trigger");
    fireEvent.click(mountButton);

    // Test is successful if no error is thrown
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
  });

  it("should format file size correctly", () => {
    const mockOnChange = vi.fn();
    render(<MacroCodeEditor value="test" onChange={mockOnChange} language="python" />);

    // Check that file size is displayed (4 B for "test")
    const sizeText = screen.getByText(/1 lines • 4 B/i);
    expect(sizeText).toBeInTheDocument();
  });
});
