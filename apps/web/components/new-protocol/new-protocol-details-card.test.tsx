import { render, screen } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";

import type { CreateProtocolRequestBody } from "@repo/api";
import { Form } from "@repo/ui/components";

import { NewProtocolDetailsCard } from "./new-protocol-details-card";

// Mock tsr (macro search API)
vi.mock("../../lib/tsr", () => ({
  tsr: {
    ReactQueryProvider: ({ children }: { children: React.ReactNode }) => children,
    macros: {
      listMacros: {
        useQuery: () => ({ data: { body: [] }, isLoading: false, error: null }),
      },
    },
  },
}));

// Mock MacroSearchWithDropdown
vi.mock("../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: () => <div data-testid="macro-search-dropdown" />,
}));

// Mock useDebounce
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, true],
}));

// Mock RichTextarea (Quill editor)
vi.mock("@repo/ui/components", async (importOriginal) => {
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

const TestWrapper = ({ defaultValues }: { defaultValues?: Partial<CreateProtocolRequestBody> }) => {
  const form = useForm<CreateProtocolRequestBody>({
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
      <NewProtocolDetailsCard
        form={form}
        selectedMacros={[]}
        onAddMacro={vi.fn()}
        onRemoveMacro={vi.fn()}
      />
    </Form>
  );
};

describe("NewProtocolDetailsCard", () => {
  it("should render name input with label", () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText("newProtocol.name")).toBeInTheDocument();
  });

  it("should render description field with placeholder", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("newProtocol.description_field")).toBeInTheDocument();
  });

  it("should display initial name value", () => {
    render(<TestWrapper defaultValues={{ name: "My Protocol" }} />);

    expect(screen.getByDisplayValue("My Protocol")).toBeInTheDocument();
  });

  it("should render both form fields", () => {
    render(<TestWrapper />);

    // Name input
    const nameInput = screen.getByLabelText("newProtocol.name");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");

    // Description textarea
    const description = screen.getByTestId("rich-textarea");
    expect(description).toBeInTheDocument();
  });
});
