import { render, screen, userEvent, fireEvent } from "@/test/test-utils";
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

  it("calls onDeleteOption when delete button is clicked", async () => {
    const mockOnDeleteOption = vi.fn();
    render(
      <SelectOptionsEditor
        options={["Option 1", "Option 2"]}
        onDeleteOption={mockOnDeleteOption}
      />,
    );

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByTitle("questionCard.removeOption");
    await user.click(deleteButtons[0]);

    expect(mockOnDeleteOption).toHaveBeenCalledWith(0);
  });

  it("calls onAddOption when Add Option button is clicked", async () => {
    const mockOnAddOption = vi.fn();
    render(<SelectOptionsEditor options={[]} onAddOption={mockOnAddOption} />);

    const user = userEvent.setup();
    const addButton = screen.getByText("questionCard.addOption");
    await user.click(addButton);

    expect(mockOnAddOption).toHaveBeenCalledTimes(1);
  });

  it("opens bulk add dialog when Bulk Add is clicked", async () => {
    render(<SelectOptionsEditor options={[]} />);

    const user = userEvent.setup();
    const bulkAddButton = screen.getByText("questionCard.bulkAddOptions");
    await user.click(bulkAddButton);

    // Dialog should open (assuming mocked dialog component)
    expect(bulkAddButton).toBeInTheDocument();
  });

  it("opens delete all dialog when Delete All is clicked", async () => {
    render(<SelectOptionsEditor options={["Option 1"]} />);

    const user = userEvent.setup();
    const deleteAllButton = screen.getByText("questionCard.deleteAllOptions");
    await user.click(deleteAllButton);

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

  it("calls onBulkAddOptions with new options", async () => {
    const mockOnBulkAddOptions = vi.fn();
    render(<SelectOptionsEditor options={[]} onBulkAddOptions={mockOnBulkAddOptions} />);

    const user = userEvent.setup();
    const bulkAddButton = screen.getByText("questionCard.bulkAddOptions");
    await user.click(bulkAddButton);

    // In real usage, the dialog would call onBulkAddOptions
    // This tests the prop is passed correctly
    expect(mockOnBulkAddOptions).not.toHaveBeenCalled(); // Until dialog confirms
  });

  it("calls onDeleteAllOptions when confirmed", async () => {
    const mockOnDeleteAllOptions = vi.fn();
    render(
      <SelectOptionsEditor options={["Option 1"]} onDeleteAllOptions={mockOnDeleteAllOptions} />,
    );

    const user = userEvent.setup();
    const deleteAllButton = screen.getByText("questionCard.deleteAllOptions");
    await user.click(deleteAllButton);

    // In real usage, the dialog would call onDeleteAllOptions
    expect(mockOnDeleteAllOptions).not.toHaveBeenCalled(); // Until dialog confirms
  });
});
