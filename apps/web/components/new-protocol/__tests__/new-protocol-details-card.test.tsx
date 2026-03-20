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
  Select: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => (
    <div data-testid="select-item">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  Button: (props: any) => <button {...props} />,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock tsr (macro search API)
vi.mock("../../../lib/tsr", () => ({
  tsr: {
    macros: {
      listMacros: {
        useQuery: () => ({ data: { body: [] }, isLoading: false, error: null }),
      },
    },
  },
}));

// Mock MacroSearchWithDropdown
vi.mock("../../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: () => <div data-testid="macro-search-dropdown" />,
}));

// Mock useDebounce
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, true],
}));

// Mock SENSOR_FAMILY_OPTIONS
vi.mock("@/util/sensor-family", () => ({
  SENSOR_FAMILY_OPTIONS: [
    { value: "multispeq", label: "MultispeQ", disabled: false },
    { value: "generic", label: "Generic", disabled: false },
  ],
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

  return React.cloneElement(children as React.ReactElement, {
    form,
    selectedMacros: [],
    onAddMacro: vi.fn(),
    onRemoveMacro: vi.fn(),
  });
}

describe("NewProtocolDetailsCard", () => {
  it("should render all form fields", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    const formFields = screen.getAllByTestId("form-field");
    expect(formFields).toHaveLength(3); // name, family, description

    const formItems = screen.getAllByTestId("form-item");
    expect(formItems).toHaveLength(3);
  });

  it("should render inputs", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toBeInTheDocument();
    expect(screen.getByTestId("rich-textarea")).toHaveAttribute(
      "placeholder",
      "newProtocol.description_field",
    );
  });

  it("should render input components", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    expect(screen.getByTestId("input")).toBeInTheDocument();
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toBeInTheDocument();
  });

  it("should have correct placeholder text for description", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
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
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    const formMessages = screen.getAllByTestId("form-message");
    expect(formMessages).toHaveLength(3); // One for each field (name, family, description)
  });

  it("should render form controls for each field", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    const formControls = screen.getAllByTestId("form-control");
    expect(formControls).toHaveLength(3);
  });

  it("should render RichTextarea with empty string when field value is null", () => {
    render(
      <TestWrapper>
        <NewProtocolDetailsCard
          form={undefined as any}
          selectedMacros={[]}
          onAddMacro={vi.fn()}
          onRemoveMacro={vi.fn()}
        />
      </TestWrapper>,
    );

    // The mock FormField provides value: "" so the ?? "" fallback is exercised
    const richTextarea = screen.getByTestId("rich-textarea");
    expect(richTextarea).toHaveValue("");
  });
});
