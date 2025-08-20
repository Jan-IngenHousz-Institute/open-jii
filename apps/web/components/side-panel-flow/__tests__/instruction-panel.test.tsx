import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { InstructionPanel } from "../instruction-panel";

// --- Mocks ---
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
interface MockRichTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}
vi.mock("@repo/ui/components", async (orig) => {
  const actualMod = await orig();
  const { Card, CardHeader, CardTitle, CardContent } = actualMod as {
    Card: React.ComponentType<React.PropsWithChildren<{ className?: string }>>;
    CardHeader: React.ComponentType<React.PropsWithChildren>;
    CardTitle: React.ComponentType<React.PropsWithChildren<{ className?: string }>>;
    CardContent: React.ComponentType<React.PropsWithChildren>;
  };
  const RichTextarea = ({ value, onChange, placeholder, isDisabled }: MockRichTextareaProps) => (
    <textarea
      aria-label="rich-textarea"
      placeholder={placeholder}
      value={value}
      disabled={isDisabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return { Card, CardHeader, CardTitle, CardContent, RichTextarea };
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
