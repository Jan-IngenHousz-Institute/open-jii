import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormatSelectionStep } from "../steps/format-selection-step";

globalThis.React = React;

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    form,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "submit" | "reset" | "button";
    form?: string;
    variant?: string;
    className?: string;
  }) => {
    const getTestId = () => {
      const childText = React.Children.toArray(children)
        .map((child) => (typeof child === "string" ? child : ""))
        .join("");
      if (childText.includes("common.back")) return "back-button";
      if (childText.includes("common.close")) return "close-button";
      return "submit-button";
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        type={type}
        form={form}
        data-variant={variant}
        className={className}
        data-testid={getTestId()}
      >
        {children}
      </button>
    );
  },
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({
    render,
  }: {
    control: unknown;
    name: string;
    render: (props: {
      field: { value: string; onChange: (value: string) => void };
    }) => React.ReactNode;
  }) => {
    const [value, setValue] = React.useState("");
    return render({ field: { value, onChange: setValue } });
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormMessage: () => <div data-testid="form-message" />,
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button data-testid="select-csv" onClick={() => onValueChange("csv")}>
        Select CSV
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div data-testid="select-value" />,
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    handleSubmit: (onSubmit: (data: { format: string }) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({ format: "csv" });
    },
    watch: (field: string) => (field === "format" ? "csv" : ""),
    control: {},
  }),
}));

// Mock @hookform/resolvers/zod
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => ({}),
}));

describe("FormatSelectionStep", () => {
  const mockOnFormatSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const defaultProps = {
    onFormatSubmit: mockOnFormatSubmit,
    onBack: mockOnBack,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStep = (props = {}) => {
    render(<FormatSelectionStep {...defaultProps} {...props} />);
  };

  it("renders back button in dialog footer", () => {
    renderStep();

    const backButton = screen.getByTestId("back-button");
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveTextContent("common.back");
  });

  it("renders submit button in dialog footer", () => {
    renderStep();

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveTextContent("experimentData.exportModal.createExport");
  });

  it("calls onBack when back button is clicked", () => {
    renderStep();

    const backButton = screen.getByTestId("back-button");
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("calls onFormatSubmit when form is submitted with CSV format", async () => {
    renderStep();

    // Select CSV format
    const selectCsvButton = screen.getByTestId("select-csv");
    fireEvent.click(selectCsvButton);

    // Submit form
    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnFormatSubmit).toHaveBeenCalledWith("csv");
    });
  });

  it("has form with correct id for external submission", () => {
    renderStep();

    const form = document.getElementById("format-selection-form");
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute("id", "format-selection-form");
  });

  it("disables submit button when isCreating is true", () => {
    renderStep({ isCreating: true });

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toBeDisabled();
  });

  it("shows creating text when isCreating is true", () => {
    renderStep({ isCreating: true });

    expect(screen.getByText("experimentData.exportModal.creating")).toBeInTheDocument();
  });

  it("shows create export text when isCreating is false", () => {
    renderStep({ isCreating: false });

    expect(screen.getByText("experimentData.exportModal.createExport")).toBeInTheDocument();
  });

  it("submit button references correct form", () => {
    renderStep();

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toHaveAttribute("form", "format-selection-form");
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("displays format label correctly", () => {
    renderStep();

    expect(screen.getByText("experimentData.exportModal.format")).toBeInTheDocument();
  });

  it("renders CSV option in select", () => {
    renderStep();

    expect(screen.getByText("CSV")).toBeInTheDocument();
  });
});
