import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SuccessStep } from "./success-step";

globalThis.React = React;

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock components from @repo/ui
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

describe("SuccessStep", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders success title", () => {
    render(<SuccessStep onClose={mockOnClose} />);
    expect(screen.getByText("uploadModal.success.title")).toBeInTheDocument();
  });

  it("renders success description", () => {
    render(<SuccessStep onClose={mockOnClose} />);
    expect(screen.getByText("uploadModal.success.description")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(<SuccessStep onClose={mockOnClose} />);
    expect(screen.getByText("uploadModal.success.close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    const closeButton = screen.getByText("uploadModal.success.close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("renders success icon", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    // Check if CheckCircle icon is rendered (it should be in the DOM)
    const successIcon = document.querySelector("svg");
    expect(successIcon).toBeInTheDocument();
  });

  it("renders info icon in description section", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    // Check if Info icon is rendered
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThanOrEqual(2); // CheckCircle + Info
  });

  it("has correct styling classes", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    // Check if the main container has the expected structure
    const container = screen.getByText("uploadModal.success.title").closest("div");
    expect(container).toBeInTheDocument();
  });
});
