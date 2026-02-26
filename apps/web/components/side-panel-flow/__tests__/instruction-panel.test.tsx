import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { InstructionPanel } from "../instruction-panel";

// --- Mocks ---
interface MockRichTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual("@repo/ui/components");
  return {
    ...actual,
    RichTextarea: ({ value, onChange, placeholder, isDisabled }: MockRichTextareaProps) => (
      <textarea
        aria-label="rich-textarea"
        placeholder={placeholder}
        value={value}
        disabled={isDisabled}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  };
});

describe("<InstructionPanel />", () => {
  it("renders title, placeholder, and initial value", () => {
    render(<InstructionPanel value="Hello" onChange={() => void 0} disabled={false} />);

    expect(screen.getByText("instructionPanel.title")).toBeInTheDocument();
    const textarea = screen.getByLabelText<HTMLTextAreaElement>("rich-textarea");
    expect(textarea).toHaveValue("Hello");
    expect(textarea).toHaveAttribute("placeholder", "instructionPanel.placeholder");
  });

  it("fires onChange for each keystroke (controlled parent responsibility)", async () => {
    const onChange = vi.fn<(val: string) => void>();
    render(<InstructionPanel value="" onChange={onChange} disabled={false} />);

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("rich-textarea");
    await userEvent.type(textarea, "ABC");

    // Should be called once per character with that character (since parent isn't updating value)
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(["A", "B", "C"]);
  });

  it("respects disabled state (no typing events fired)", async () => {
    const onChange = vi.fn<(val: string) => void>();
    render(<InstructionPanel value="INIT" onChange={onChange} disabled />);

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("rich-textarea");
    expect(textarea).toBeDisabled();
    await userEvent.type(textarea, "X");
    expect(onChange).not.toHaveBeenCalled();
  });
});
