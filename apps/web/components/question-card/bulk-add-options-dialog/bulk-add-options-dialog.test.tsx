import { render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkAddOptionsDialog } from "./bulk-add-options-dialog";

describe("BulkAddOptionsDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnAddOptions = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    expect(screen.getByText("questionCard.bulkAdd.title")).toBeInTheDocument();
    expect(screen.getByText("questionCard.bulkAdd.description")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <BulkAddOptionsDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    expect(screen.queryByText("questionCard.bulkAdd.title")).not.toBeInTheDocument();
  });

  it("handles text input", async () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    await user.type(textarea, "Option 1{Enter}Option 2{Enter}Option 3");

    expect(textarea).toHaveValue("Option 1\nOption 2\nOption 3");
  });

  it("calls onAddOptions with parsed options when Add is clicked", async () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    await user.type(textarea, "Plot A{Enter}Plot B{Enter}{Enter}Plot C{Enter}  ");

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    await user.click(addButton);

    expect(mockOnAddOptions).toHaveBeenCalledWith(["Plot A", "Plot B", "Plot C"]);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("filters out empty lines", async () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    await user.type(textarea, "{Enter}{Enter}Option 1{Enter}{Enter}{Enter}Option 2{Enter}{Enter}");

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    await user.click(addButton);

    expect(mockOnAddOptions).toHaveBeenCalledWith(["Option 1", "Option 2"]);
  });

  it("trims whitespace from options", async () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    await user.type(textarea, "  Option 1  {Enter}  Option 2  ");

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    await user.click(addButton);

    expect(mockOnAddOptions).toHaveBeenCalledWith(["Option 1", "Option 2"]);
  });

  it("disables Add button when textarea is empty", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    expect(addButton).toBeDisabled();
  });

  it("clears textarea when cancelled", async () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    await user.type(textarea, "Option 1{Enter}Option 2");

    const cancelButton = screen.getByText("questionCard.bulkAdd.cancel");
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
