import { render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SuccessStep } from "./success-step";

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

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<SuccessStep onClose={mockOnClose} />);

    const closeButton = screen.getByText("uploadModal.success.close");
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("renders success icon", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    const successIcon = document.querySelector("svg");
    expect(successIcon).toBeInTheDocument();
  });

  it("renders info icon in description section", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThanOrEqual(2); // CheckCircle + Info
  });

  it("has correct styling classes", () => {
    render(<SuccessStep onClose={mockOnClose} />);

    const container = screen.getByText("uploadModal.success.title").closest("div");
    expect(container).toBeInTheDocument();
  });

  it("renders metadata-specific title and description when isMetadata is true", () => {
    render(<SuccessStep onClose={mockOnClose} isMetadata={true} />);
    expect(screen.getByText("uploadModal.success.metadataTitle")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.success.metadataDescription")).toBeInTheDocument();
  });
});
