import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateCommandRequestBody } from "@repo/api/schemas/command.schema";
import { Form } from "@repo/ui/components/form";

import { NewCommandDetailsCard } from "./new-command-details-card";

// Mock MacroSearchWithDropdown
vi.mock("../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: () => <div data-testid="macro-search-dropdown" />,
}));

// Mock useDebounce
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, true],
}));

// Mock RichTextarea (Quill editor)
vi.mock("@repo/ui/components/rich-textarea", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    RichTextarea: ({
      value,
      onChange,
      placeholder,
    }: {
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    }) => (
      <textarea
        data-testid="rich-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    ),
  };
});

const TestWrapper = ({ defaultValues }: { defaultValues?: Partial<CreateCommandRequestBody> }) => {
  const form = useForm<CreateCommandRequestBody>({
    defaultValues: {
      name: "",
      description: "",
      code: [{}],
      family: "generic",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <NewCommandDetailsCard
        form={form}
        selectedMacros={[]}
        onAddMacro={vi.fn()}
        onRemoveMacro={vi.fn()}
      />
    </Form>
  );
};

describe("NewCommandDetailsCard", () => {
  beforeEach(() => {
    server.mount(contract.macros.listMacros, { body: [] });
  });

  it("should render name input with label", () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText("newCommand.name")).toBeInTheDocument();
  });

  it("should render description field with placeholder", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("newCommand.description_field")).toBeInTheDocument();
  });

  it("should display initial name value", () => {
    render(<TestWrapper defaultValues={{ name: "My Command" }} />);

    expect(screen.getByDisplayValue("My Command")).toBeInTheDocument();
  });

  it("should render both form fields", () => {
    render(<TestWrapper />);

    // Name input
    const nameInput = screen.getByLabelText("newCommand.name");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");

    // Description textarea
    const description = screen.getByTestId("rich-textarea");
    expect(description).toBeInTheDocument();
  });
});
