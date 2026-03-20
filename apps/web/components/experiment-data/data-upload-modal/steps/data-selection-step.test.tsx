import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_OPTIONS, DataSelectionStep } from "./data-selection-step";
import type { DataOption } from "./data-selection-step";

globalThis.React = React;

// Mock translation – return the key so we can assert on it
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Minimal UI component mocks
vi.mock("@repo/ui/components", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode; className?: string }) => (
    <label {...props}>{children}</label>
  ),
  RadioGroup: ({
    children,
    onValueChange: _onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
    className?: string;
  }) => (
    <div data-testid="radio-group" data-value={value}>
      {children}
    </div>
  ),
  RadioGroupItem: ({
    value,
    disabled,
    ..._props
  }: {
    value: string;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
  }) => <input type="radio" value={value} disabled={disabled} data-testid={`radio-${value}`} />,
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cva: (base: string, _config: Record<string, unknown>) => (_props: Record<string, unknown>) =>
    base,
}));

vi.mock("lucide-react", () => ({
  Database: () => <span data-testid="icon-database" />,
  FileSpreadsheet: () => <span data-testid="icon-file-spreadsheet" />,
}));

describe("DataSelectionStep", () => {
  const mockOnOptionSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStep = (selectedOption: DataOption | null = null) =>
    render(
      <DataSelectionStep selectedOption={selectedOption} onOptionSelect={mockOnOptionSelect} />,
    );

  it("renders all data options", () => {
    renderStep();

    expect(screen.getByTestId("data-option-multispeq")).toBeInTheDocument();
    expect(screen.getByTestId("data-option-ambyte")).toBeInTheDocument();
    expect(screen.getByTestId("data-option-metadata")).toBeInTheDocument();
  });

  it("renders sensor data section and metadata section", () => {
    renderStep();

    // Section headers (translation keys)
    expect(screen.getByText("uploadModal.sections.sensorData")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.sections.sensorDataDescription")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.sections.metadata")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.sections.metadataDescription")).toBeInTheDocument();
  });

  it("renders a separator between sections", () => {
    renderStep();

    expect(screen.getByTestId("separator")).toBeInTheDocument();
  });

  it("shows coming soon badge for disabled options", () => {
    renderStep();

    // The multispeq option is disabled, so it should show the comingSoon key
    expect(screen.getByText("uploadModal.comingSoon")).toBeInTheDocument();
  });

  it("calls onOptionSelect when clicking an enabled option", () => {
    renderStep();

    const ambyteOption = screen.getByTestId("data-option-ambyte");
    fireEvent.click(ambyteOption);

    expect(mockOnOptionSelect).toHaveBeenCalledTimes(1);
    expect(mockOnOptionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ambyte", category: "sensor" }),
    );
  });

  it("calls onOptionSelect when clicking the metadata option", () => {
    renderStep();

    const metadataOption = screen.getByTestId("data-option-metadata");
    fireEvent.click(metadataOption);

    expect(mockOnOptionSelect).toHaveBeenCalledTimes(1);
    expect(mockOnOptionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "metadata", category: "metadata" }),
    );
  });

  it("does not call onOptionSelect when clicking a disabled option", () => {
    renderStep();

    const multispeqOption = screen.getByTestId("data-option-multispeq");
    fireEvent.click(multispeqOption);

    expect(mockOnOptionSelect).not.toHaveBeenCalled();
  });

  it("renders radio buttons for each option", () => {
    renderStep();

    expect(screen.getByTestId("radio-multispeq")).toBeInTheDocument();
    expect(screen.getByTestId("radio-ambyte")).toBeInTheDocument();
    expect(screen.getByTestId("radio-metadata")).toBeInTheDocument();
  });

  it("disables the radio button for disabled options", () => {
    renderStep();

    const multispeqRadio = screen.getByTestId("radio-multispeq");
    expect(multispeqRadio).toBeDisabled();

    const ambyteRadio = screen.getByTestId("radio-ambyte");
    expect(ambyteRadio).not.toBeDisabled();
  });

  it("exports DATA_OPTIONS with correct structure", () => {
    expect(DATA_OPTIONS).toHaveLength(3);

    const sensorOptions = DATA_OPTIONS.filter((o) => o.category === "sensor");
    const metadataOptions = DATA_OPTIONS.filter((o) => o.category === "metadata");

    expect(sensorOptions).toHaveLength(2);
    expect(metadataOptions).toHaveLength(1);

    expect(sensorOptions[0].id).toBe("multispeq");
    expect(sensorOptions[0].disabled).toBe(true);
    expect(sensorOptions[1].id).toBe("ambyte");
    expect(sensorOptions[1].disabled).toBe(false);
    expect(metadataOptions[0].id).toBe("metadata");
    expect(metadataOptions[0].disabled).toBe(false);
  });
});
