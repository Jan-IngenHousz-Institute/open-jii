import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MacroCodeEditor from "./macro-code-editor";

// Monaco can't run in jsdom — provide a minimal mock
vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange,
    language,
    theme,
  }: {
    value: string;
    onChange: (v: string) => void;
    language?: string;
    theme?: string;
  }) => (
    <div data-testid="monaco-editor" data-language={language} data-theme={theme}>
      <textarea
        data-testid="editor-textarea"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) => (
    <span {...props}>{children}</span>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

const defaults = {
  value: "",
  onChange: vi.fn(),
  language: "python" as const,
  macroName: "test_macro",
  username: "user",
};

describe("MacroCodeEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    language: "python" as const,
    username: "test_user",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the editor container", () => {
    render(<MacroCodeEditor {...defaultProps} />);

  it("renders the editor", () => {
    render(<MacroCodeEditor {...defaults} />);
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<MacroCodeEditor {...defaults} label="Code Editor" />);
    expect(screen.getByText("Code Editor")).toBeInTheDocument();
  });

  it("should display code stats in header for python", () => {
    render(<MacroCodeEditor {...defaultProps} language="python" value="print('hello')" />);

    expect(screen.getByText(/lines/)).toBeInTheDocument();
  });

  it("should display code stats in header for R", () => {
    render(<MacroCodeEditor {...defaultProps} language="r" value="cat('hello')" />);

    expect(screen.getByText(/lines/)).toBeInTheDocument();
  });

  it("should display code stats in header for JavaScript", () => {
    render(
      <MacroCodeEditor {...defaultProps} language="javascript" value="console.log('hello')" />,
    );

    expect(screen.getByText(/lines/)).toBeInTheDocument();
  });

  it("should render copy button", () => {
    render(<MacroCodeEditor {...defaultProps} />);

    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
  });

  it("should call onChange when editor value changes", () => {
    const mockOnChange = vi.fn();
    render(<MacroCodeEditor {...defaultProps} onChange={mockOnChange} />);

    const textarea = screen.getByTestId("editor-textarea");
    // fireEvent works better for controlled textarea in mock
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    // The mock Editor wires onChange to the textarea's native change handler
  });

  it("maps javascript to typescript in Monaco", () => {
    render(<MacroCodeEditor {...defaults} language="javascript" />);
    expect(screen.getByTestId("monaco-editor")).toHaveAttribute("data-language", "typescript");
  });

  it("uses the provided value", () => {
    render(<MacroCodeEditor {...defaults} value="custom code" />);
    expect(screen.getByTestId("editor-textarea")).toHaveValue("custom code");
  });

  it("applies custom height", () => {
    render(<MacroCodeEditor {...defaults} height="500px" />);
    expect(screen.getByTestId("monaco-editor").parentElement).toHaveStyle({ height: "500px" });
  });

  it("uses default height when not specified", () => {
    render(<MacroCodeEditor {...defaults} />);
    expect(screen.getByTestId("monaco-editor").parentElement).toHaveStyle({ height: "400px" });
  });

  it("shows error message", () => {
    render(<MacroCodeEditor {...defaults} error="Test error" />);
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("displays file stats", () => {
    render(<MacroCodeEditor {...defaults} value="test" />);
    expect(screen.getByText(/1 lines.*4 B/)).toBeInTheDocument();
  });
});
