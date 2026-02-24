import { renderWithForm, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { CreateMacroRequestBody } from "@repo/api";

import { NewMacroDetailsCard } from "./new-macro-details-card";

// RichTextarea uses Quill (needs browser DOM) — mock with plain textarea
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components");
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
  it("renders card with title and description", () => {
    setup();
    expect(screen.getByText("newMacro.detailsTitle")).toBeInTheDocument();
    expect(screen.getByText("newMacro.detailsDescription")).toBeInTheDocument();
  });

  it("renders name and description labels", () => {
    setup();
    expect(screen.getByText("newMacro.name")).toBeInTheDocument();
    expect(screen.getByText("newMacro.description")).toBeInTheDocument();
  });

  it("renders input and textarea", () => {
    setup();
    // Both the name <input> and the RichTextarea mock <textarea> have role="textbox"
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    // RichTextarea mock renders a <textarea>
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
  });

  it("renders description placeholder", () => {
    setup();
    expect(screen.getByPlaceholderText("newMacro.description")).toBeInTheDocument();
  });
});
