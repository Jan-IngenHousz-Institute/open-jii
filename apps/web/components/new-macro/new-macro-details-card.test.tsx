import { renderWithForm, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { CreateMacroRequestBody } from "@repo/api";

import { NewMacroDetailsCard } from "./new-macro-details-card";

// RichTextarea uses Quill (needs browser DOM) — mock with plain textarea
vi.mock("@repo/ui/components/rich-textarea", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@repo/ui/components/rich-textarea",
  );
  return {
    ...actual,
    RichTextarea: (props: {
      placeholder?: string;
      value?: string;
      onChange?: (v: string) => void;
    }) => (
      <textarea
        data-testid="rich-textarea"
        placeholder={props.placeholder}
        value={props.value ?? ""}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    ),
  };
});

const defaults: CreateMacroRequestBody = {
  name: "",
  description: "",
  language: "python",
  code: "",
};

const setup = () =>
  renderWithForm<CreateMacroRequestBody>((form) => <NewMacroDetailsCard form={form} />, {
    useFormProps: { defaultValues: defaults },
  });

describe("NewMacroDetailsCard", () => {
  it("renders name input with placeholder", () => {
    setup();
    expect(screen.getByPlaceholderText("newMacro.name")).toBeInTheDocument();
  });

  it("should render input components", () => {
    render(
      <TestWrapper>
        <NewMacroDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toBeInTheDocument();
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
  });

  it("renders description placeholder", () => {
    setup();
    expect(screen.getByPlaceholderText("newMacro.description")).toBeInTheDocument();
  });
});
