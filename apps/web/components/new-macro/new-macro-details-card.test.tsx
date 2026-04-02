/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { useForm } from "react-hook-form";
import { vi, describe, it, expect } from "vitest";

import type { CreateMacroRequestBody } from "@repo/api";

import { NewMacroDetailsCard } from "./new-macro-details-card";

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
  Select: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
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
  it("should render all form fields", () => {
    render(
      <TestWrapper>
        <NewMacroDetailsCard form={undefined as any} />
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
        <NewMacroDetailsCard form={undefined as any} />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toHaveAttribute("placeholder", "newMacro.name");
    expect(screen.getByTestId("rich-textarea")).toHaveAttribute(
      "placeholder",
      "newMacro.description",
    );
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
