import { render, screen, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { WorkbookCodeEditor } from "./workbook-code-editor";

// CodeEditor is globally mocked in test/setup.ts (CodeMirror can't run in jsdom).
// The mock renders a <textarea> (role="textbox") that forwards value/onChange/readOnly.

describe("WorkbookCodeEditor", () => {
  it("displays the given value", () => {
    render(<WorkbookCodeEditor value='{"a":1}' language="json" />);
    expect(screen.getByRole("textbox")).toHaveValue('{"a":1}');
  });

  it("calls onChange when the user edits", () => {
    const onChange = vi.fn();
    render(<WorkbookCodeEditor value="" language="python" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "x = 1" },
    });

    expect(onChange).toHaveBeenCalledWith("x = 1");
  });

  it("prevents editing when readOnly", () => {
    render(<WorkbookCodeEditor value="frozen" language="json" readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("forwards the language to the editor", () => {
    render(<WorkbookCodeEditor value="" language="python" />);
    // The global mock exposes language as data-language on the editor container
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "python");
  });
});
