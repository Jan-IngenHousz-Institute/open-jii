import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MacroCodeEditor from "./macro-code-editor";

// CodeEditor is globally mocked in test/setup.ts (CodeMirror can't run in jsdom)

const defaults = {
  value: "",
  onChange: vi.fn(),
  language: "python" as const,
};

describe("MacroCodeEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a label, the editor, and file stats reflecting the code", () => {
    const code = "line1\nline2";
    render(<MacroCodeEditor {...defaults} value={code} label="Code Editor" />);

    expect(screen.getByText("Code Editor")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByText(/2 lines/)).toBeInTheDocument();
  });

  it("calls onChange when the user types in the editor", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MacroCodeEditor {...defaults} onChange={onChange} />);

    const textarea = screen.getByTestId("code-editor-textarea");
    await user.type(textarea, "x = 1");

    expect(onChange).toHaveBeenCalled();
  });

  it("copies code to clipboard when the user clicks the copy button", async () => {
    const user = userEvent.setup();
    const code = "print('hello')";
    render(<MacroCodeEditor {...defaults} value={code} />);

    const copyButton = screen.getByRole("button");
    // Initially shows Copy icon
    expect(copyButton.querySelector(".lucide-copy")).toBeInTheDocument();

    await user.click(copyButton);

    // After clicking, the icon changes to Check indicating success
    await waitFor(() => {
      expect(copyButton.querySelector(".lucide-check")).toBeInTheDocument();
    });
  });

  it("shows an error message when the error prop is provided", () => {
    render(<MacroCodeEditor {...defaults} error="Syntax error on line 3" />);
    expect(screen.getByText("Syntax error on line 3")).toBeInTheDocument();
  });

  it("applies custom height to the editor container", () => {
    render(<MacroCodeEditor {...defaults} height="500px" />);
    expect(screen.getByTestId("code-editor").parentElement).toHaveStyle({ height: "500px" });
  });

  it("uses default height of 400px when not specified", () => {
    render(<MacroCodeEditor {...defaults} />);
    expect(screen.getByTestId("code-editor").parentElement).toHaveStyle({ height: "400px" });
  });

  it("passes the language to the CodeEditor", () => {
    render(<MacroCodeEditor {...defaults} language="javascript" />);
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "javascript");
  });
});
