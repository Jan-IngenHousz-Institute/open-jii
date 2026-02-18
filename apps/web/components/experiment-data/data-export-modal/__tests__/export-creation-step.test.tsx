import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportCreationStep } from "../steps/export-creation-step";

globalThis.React = React;

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  CheckCircle: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-icon" className={className} />
  ),
  XCircle: ({ className }: { className?: string }) => (
    <span data-testid="error-icon" className={className} />
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className} data-testid="back-button">
      {children}
    </button>
  ),
}));

describe("ExportCreationStep", () => {
  const mockOnBackToList = vi.fn();

  const defaultProps = {
    format: "csv",
    status: "loading" as const,
    onBackToList: mockOnBackToList,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with spinner", () => {
    render(<ExportCreationStep {...defaultProps} />);

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.creatingTitle")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.creatingDescription")).toBeInTheDocument();
  });

  it("does not show back button during loading", () => {
    render(<ExportCreationStep {...defaultProps} />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  it("renders success state", () => {
    render(<ExportCreationStep {...defaultProps} status="success" />);

    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.creationSuccess")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.exportModal.creationSuccessDescription"),
    ).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<ExportCreationStep {...defaultProps} status="error" />);

    expect(screen.getByTestId("error-icon")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.creationError")).toBeInTheDocument();
  });

  it("displays error message when provided", () => {
    // prettier-ignore
    render(<ExportCreationStep {...defaultProps} status="error" errorMessage="Network timeout" />);

    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("shows back button on success state", () => {
    render(<ExportCreationStep {...defaultProps} status="success" />);

    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("shows back button on error state", () => {
    render(<ExportCreationStep {...defaultProps} status="error" />);

    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("calls onBackToList when back button is clicked", () => {
    render(<ExportCreationStep {...defaultProps} status="success" />);

    fireEvent.click(screen.getByTestId("back-button"));

    expect(mockOnBackToList).toHaveBeenCalledTimes(1);
  });
});
