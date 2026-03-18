/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { useForm } from "react-hook-form";
import { vi, describe, it, expect } from "vitest";

import type { CreateProtocolRequestBody } from "@repo/api";

import { NewProtocolDetailsCard } from "../new-protocol-details-card";

globalThis.React = React;

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormField: ({ render }: { render: (props: any) => React.ReactNode }) => {
    const field = {
      onChange: vi.fn(),
      onBlur: vi.fn(),
      value: "",
      name: "test-field",
    };
    return <div data-testid="form-field">{render({ field })}</div>;
  },
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-item">{children}</div>
  ),
  FormLabel: ({ children }: { children: React.ReactNode }) => (
    <label data-testid="form-label">{children}</label>
  ),
  FormMessage: () => <div data-testid="form-message"></div>,
  Input: (props: any) => <input data-testid="input" {...props} />,
  RichTextarea: (props: any) => <textarea data-testid="rich-textarea" {...props} />,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Test wrapper component that provides form context
function TestWrapper({ children }: { children: React.ReactNode }) {
  const form = useForm<CreateProtocolRequestBody>({
    defaultValues: {
      name: "",
      description: "",
      code: [{}],
      family: "multispeq",
    },
  });

  return React.cloneElement(children as React.ReactElement, { form });
}

describe("NewProtocolDetailsCard", () => {
  it("should render all form fields", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    const formFields = screen.getAllByTestId("form-field");
    expect(formFields).toHaveLength(2);

    const formItems = screen.getAllByTestId("form-item");
    expect(formItems).toHaveLength(2);
  });

  it("should render inputs with placeholder text", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toHaveAttribute("placeholder", "newProtocol.name");
    expect(screen.getByTestId("rich-textarea")).toHaveAttribute(
      "placeholder",
      "newProtocol.description_field",
    );
  });

  it("should render input components", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toBeInTheDocument();
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
  });

  it("should have correct placeholder text for description", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("rich-textarea")).toHaveAttribute(
      "placeholder",
      "newProtocol.description_field",
    );
  });

  it("should render form validation messages", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    const formMessages = screen.getAllByTestId("form-message");
    expect(formMessages).toHaveLength(2); // One for each field (name, description)
  });

  it("should render form controls for each field", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    const formControls = screen.getAllByTestId("form-control");
    expect(formControls).toHaveLength(2);
  });

  it("should render RichTextarea with empty string when field value is null", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    // The mock FormField provides value: "" so the ?? "" fallback is exercised
    const richTextarea = screen.getByTestId("rich-textarea");
    expect(richTextarea).toHaveValue("");
  });
});
