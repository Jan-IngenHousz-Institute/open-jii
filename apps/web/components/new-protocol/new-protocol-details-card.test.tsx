import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";

import type { CreateProtocolRequestBody } from "@repo/api";
import { Form } from "@repo/ui/components";

import { NewProtocolDetailsCard } from "./new-protocol-details-card";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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
      <NewProtocolDetailsCard form={form} />
    </Form>
  );
};

describe("NewProtocolDetailsCard", () => {
  it("should render card title and description", () => {
    render(<TestWrapper />);

    expect(screen.getByText("newProtocol.detailsTitle")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.detailsDescription")).toBeInTheDocument();
  });

  it("should render name input field", () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText("newProtocol.name")).toBeInTheDocument();
  });

  it("should render description field", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.description_field")).toBeInTheDocument();
  });

  it("should render family select field", () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText("newProtocol.family")).toBeInTheDocument();
  });

  it("should display initial name value", () => {
    render(<TestWrapper defaultValues={{ name: "My Protocol" }} />);

    expect(screen.getByDisplayValue("My Protocol")).toBeInTheDocument();
  });

  it("should show default family value in select trigger", () => {
    render(<TestWrapper />);

    // Default family is "generic" which displays as "Generic"
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Generic");
  });

  it("should render select trigger for family", () => {
    render(<TestWrapper />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
  });
});
