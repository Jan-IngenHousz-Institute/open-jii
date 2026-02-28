import { render, screen, userEvent } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteAllOptionsDialog } from "./delete-all-options-dialog";

describe("DeleteAllOptionsDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <DeleteAllOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={5}
      />,
    );

    expect(screen.getByText("questionCard.deleteAll.title")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <DeleteAllOptionsDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={5}
      />,
    );

    expect(screen.queryByText("questionCard.deleteAll.title")).not.toBeInTheDocument();
  });

  it("displays the correct count in description", () => {
    render(
      <DeleteAllOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={10}
      />,
    );

    // The translation key is passed with the count parameter
    expect(screen.getByText(/questionCard.deleteAll.description/)).toBeInTheDocument();
  });

  it("calls onConfirm when Delete All is clicked", async () => {
    render(
      <DeleteAllOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={5}
      />,
    );

    const deleteButton = screen.getByText("questionCard.deleteAll.confirm");
    const user = userEvent.setup();
    await user.click(deleteButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders cancel button", () => {
    render(
      <DeleteAllOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={5}
      />,
    );

    const cancelButton = screen.getByText("questionCard.deleteAll.cancel");
    expect(cancelButton).toBeInTheDocument();
  });

  it("has destructive styling on confirm button", () => {
    render(
      <DeleteAllOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
        optionCount={5}
      />,
    );

    const deleteButton = screen.getByText("questionCard.deleteAll.confirm");
    expect(deleteButton).toHaveClass("bg-red-600");
  });
});
