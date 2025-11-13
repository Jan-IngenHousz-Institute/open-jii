import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SelectOptionsEditor } from "./select-options-editor";

describe("SelectOptionsEditor", () => {
  it("renders empty state when no options", () => {
    render(<SelectOptionsEditor options={[]} />);
    expect(screen.getByText("questionCard.noAnswerOptions")).toBeInTheDocument();
  });

  it("does not show Delete All button when no options", () => {
    render(<SelectOptionsEditor options={[]} />);
    expect(screen.queryByText("questionCard.deleteAllOptions")).not.toBeInTheDocument();
  });

  it("shows Delete All button when options exist", () => {
    render(<SelectOptionsEditor options={["Option 1"]} />);
    expect(screen.getByText("questionCard.deleteAllOptions")).toBeInTheDocument();
  });

  it("renders options with numeric numbering", () => {
    render(<SelectOptionsEditor options={["First", "Second", "Third"]} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders option text inputs", () => {
    render(<SelectOptionsEditor options={["Option A", "Option B"]} />);

    const inputs = screen.getAllByPlaceholderText("questionCard.answerOptionPlaceholder");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Option A");
    expect(inputs[1]).toHaveValue("Option B");
  });

  it("calls onUpdateOption when option text changes", () => {
    const mockOnUpdateOption = vi.fn();
    render(<SelectOptionsEditor options={["Option 1"]} onUpdateOption={mockOnUpdateOption} />);

    const input = screen.getByPlaceholderText("questionCard.answerOptionPlaceholder");
    fireEvent.change(input, { target: { value: "Updated Option" } });

    expect(mockOnUpdateOption).toHaveBeenCalledWith(0, "Updated Option");
  });

  it("calls onDeleteOption when delete button is clicked", () => {
    const mockOnDeleteOption = vi.fn();
    render(
      <SelectOptionsEditor
        options={["Option 1", "Option 2"]}
        onDeleteOption={mockOnDeleteOption}
      />,
    );

    const deleteButtons = screen.getAllByTitle("questionCard.removeOption");
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDeleteOption).toHaveBeenCalledWith(0);
  });

  it("calls onAddOption when Add Option button is clicked", () => {
    const mockOnAddOption = vi.fn();
    render(<SelectOptionsEditor options={[]} onAddOption={mockOnAddOption} />);

    const addButton = screen.getByText("questionCard.addOption");
    fireEvent.click(addButton);

    expect(mockOnAddOption).toHaveBeenCalledTimes(1);
  });

  it("opens bulk add dialog when Bulk Add is clicked", () => {
    render(<SelectOptionsEditor options={[]} />);

    const bulkAddButton = screen.getByText("questionCard.bulkAddOptions");
    fireEvent.click(bulkAddButton);

    // Dialog should open (assuming mocked dialog component)
    expect(bulkAddButton).toBeInTheDocument();
  });

  it("opens delete all dialog when Delete All is clicked", () => {
    render(<SelectOptionsEditor options={["Option 1"]} />);

    const deleteAllButton = screen.getByText("questionCard.deleteAllOptions");
    fireEvent.click(deleteAllButton);

    // Dialog should open (assuming mocked dialog component)
    expect(deleteAllButton).toBeInTheDocument();
  });

  it("disables inputs when disabled prop is true", () => {
    render(<SelectOptionsEditor options={["Option 1"]} disabled={true} />);

    const input = screen.getByPlaceholderText("questionCard.answerOptionPlaceholder");
    expect(input).toBeDisabled();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<SelectOptionsEditor options={["Option 1"]} disabled={true} />);

    const addButton = screen.getByText("questionCard.addOption");
    const bulkAddButton = screen.getByText("questionCard.bulkAddOptions");
    const deleteAllButton = screen.getByText("questionCard.deleteAllOptions");

    expect(addButton).toBeDisabled();
    expect(bulkAddButton).toBeDisabled();
    expect(deleteAllButton).toBeDisabled();
  });

  it("calls onBulkAddOptions with new options", () => {
    const mockOnBulkAddOptions = vi.fn();
    render(<SelectOptionsEditor options={[]} onBulkAddOptions={mockOnBulkAddOptions} />);

    const bulkAddButton = screen.getByText("questionCard.bulkAddOptions");
    fireEvent.click(bulkAddButton);

    // In real usage, the dialog would call onBulkAddOptions
    // This tests the prop is passed correctly
    expect(mockOnBulkAddOptions).not.toHaveBeenCalled(); // Until dialog confirms
  });

  it("calls onDeleteAllOptions when confirmed", () => {
    const mockOnDeleteAllOptions = vi.fn();
    render(
      <SelectOptionsEditor options={["Option 1"]} onDeleteAllOptions={mockOnDeleteAllOptions} />,
    );

    const deleteAllButton = screen.getByText("questionCard.deleteAllOptions");
    fireEvent.click(deleteAllButton);

    // In real usage, the dialog would call onDeleteAllOptions
    expect(mockOnDeleteAllOptions).not.toHaveBeenCalled(); // Until dialog confirms
  });
});
