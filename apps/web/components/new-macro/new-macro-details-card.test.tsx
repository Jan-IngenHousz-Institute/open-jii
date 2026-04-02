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

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Test wrapper component that provides form context
function TestWrapper({ children }: { children: React.ReactNode }) {
  const form = useForm<CreateMacroRequestBody>({
    defaultValues: {
      name: "",
      description: "",
      language: "python",
      code: "",
    },
  });

  return React.cloneElement(children as React.ReactElement, { form });
}

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

  // Tests for language selection have been removed as the language selector
  // has been moved to the code editor section

  it("should have correct placeholder text", () => {
    render(
      <TestWrapper>
        <NewMacroDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("rich-textarea")).toHaveAttribute(
      "placeholder",
      "newMacro.description",
    );
  });

  it("should render form validation messages", () => {
    render(
      <TestWrapper>
        <NewMacroDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    const formMessages = screen.getAllByTestId("form-message");
    expect(formMessages).toHaveLength(2); // One for each field (name, description)
  });
});
