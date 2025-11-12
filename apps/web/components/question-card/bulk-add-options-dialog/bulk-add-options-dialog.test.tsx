import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
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

  it("handles text input", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    fireEvent.change(textarea, { target: { value: "Option 1\nOption 2\nOption 3" } });

    expect(textarea).toHaveValue("Option 1\nOption 2\nOption 3");
  });

  it("calls onAddOptions with parsed options when Add is clicked", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    fireEvent.change(textarea, { target: { value: "Plot A\nPlot B\n\nPlot C\n  " } });

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    fireEvent.click(addButton);

    expect(mockOnAddOptions).toHaveBeenCalledWith(["Plot A", "Plot B", "Plot C"]);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("filters out empty lines", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    fireEvent.change(textarea, { target: { value: "\n\nOption 1\n\n\nOption 2\n\n" } });

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    fireEvent.click(addButton);

    expect(mockOnAddOptions).toHaveBeenCalledWith(["Option 1", "Option 2"]);
  });

  it("trims whitespace from options", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    fireEvent.change(textarea, { target: { value: "  Option 1  \n  Option 2  " } });

    const addButton = screen.getByText("questionCard.bulkAdd.add");
    fireEvent.click(addButton);

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

  it("clears textarea when cancelled", () => {
    render(
      <BulkAddOptionsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onAddOptions={mockOnAddOptions}
      />,
    );

    const textarea = screen.getByPlaceholderText("questionCard.bulkAdd.placeholder");
    fireEvent.change(textarea, { target: { value: "Option 1\nOption 2" } });

    const cancelButton = screen.getByText("questionCard.bulkAdd.cancel");
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
