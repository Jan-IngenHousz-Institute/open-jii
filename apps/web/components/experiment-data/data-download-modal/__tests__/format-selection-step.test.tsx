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
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      form={form}
      data-variant={variant}
      className={className}
      data-testid={variant === "outline" ? "close-button" : "submit-button"}
    >
      {children}
    </button>
  ),
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

// Mock zod resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => ({}),
}));

describe("FormatSelectionStep", () => {
  const mockOnFormatSubmit = vi.fn();
  const mockOnClose = vi.fn();
  const defaultProps = {
    onFormatSubmit: mockOnFormatSubmit,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStep = (props = {}) => {
    render(<FormatSelectionStep {...defaultProps} {...props} />);
  };

  it("renders format selection form", () => {
    renderStep();

    expect(screen.getByText("experimentData.downloadModal.format")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
  });

  it("renders close button in dialog footer", () => {
    renderStep();

    const closeButton = screen.getByTestId("close-button");
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveTextContent("common.close");
  });

  it("renders submit button in dialog footer", () => {
    renderStep();

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveTextContent("experimentData.downloadModal.generateLinks");
  });

  it("calls onClose when close button is clicked", () => {
    renderStep();

    const closeButton = screen.getByTestId("close-button");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
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

  it("submit button references correct form", () => {
    renderStep();

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toHaveAttribute("form", "format-selection-form");
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("displays format label correctly", () => {
    renderStep();

    expect(screen.getByText("experimentData.downloadModal.format")).toBeInTheDocument();
  });

  it("renders CSV option in select", () => {
    renderStep();

    expect(screen.getByText("CSV")).toBeInTheDocument();
  });
});
