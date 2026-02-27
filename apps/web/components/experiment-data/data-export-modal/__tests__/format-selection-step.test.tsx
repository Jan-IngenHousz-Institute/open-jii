import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { FormatSelectionStep } from "../steps/format-selection-step";

describe("FormatSelectionStep", () => {
  const onFormatSubmit = vi.fn();
  const onBack = vi.fn();

  const renderStep = (props = {}) =>
    render(<FormatSelectionStep onFormatSubmit={onFormatSubmit} onBack={onBack} {...props} />);

  it("renders back and submit buttons", () => {
    renderStep();

    expect(screen.getByRole("button", { name: /common\.back/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /experimentData\.exportModal\.createExport/i }),
    ).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    renderStep();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /common\.back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("submits selected format", async () => {
    renderStep();

    const user = userEvent.setup();
    // Open the select and choose CSV
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "CSV" }));

    // Submit
    await user.click(
      screen.getByRole("button", { name: /experimentData\.exportModal\.createExport/i }),
    );

    await waitFor(() => {
      expect(onFormatSubmit).toHaveBeenCalledWith("csv");
    });
  });

  it("shows creating text when isCreating is true", () => {
    renderStep({ isCreating: true });
    expect(screen.getByText("experimentData.exportModal.creating")).toBeInTheDocument();
  });

  it("displays format label", () => {
    renderStep();
    expect(screen.getByText("experimentData.exportModal.format")).toBeInTheDocument();
  });
});
