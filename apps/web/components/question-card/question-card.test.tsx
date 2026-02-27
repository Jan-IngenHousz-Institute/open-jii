import { render, screen, userEvent, fireEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { QuestionUI } from "./question-card";
import { QuestionCard } from "./question-card";

describe("QuestionCard", () => {
  const defaultSpec: QuestionUI = {
    answerType: "TEXT",
    validationMessage: "",
    required: false,
  };

  it("renders question input", () => {
    render(<QuestionCard stepSpecification={defaultSpec} />);
    expect(screen.getByPlaceholderText("questionCard.placeholder")).toBeInTheDocument();
  });

  it("displays question text", () => {
    const spec = { ...defaultSpec, validationMessage: "What is your name?" };
    render(<QuestionCard stepSpecification={spec} />);

    const input = screen.getByPlaceholderText("questionCard.placeholder");
    expect(input).toHaveValue("What is your name?");
  });

  it("calls onUpdateText when question text changes", async () => {
    const mockOnUpdateText = vi.fn();
    render(<QuestionCard stepSpecification={defaultSpec} onUpdateText={mockOnUpdateText} />);

    const input = screen.getByPlaceholderText("questionCard.placeholder");
    fireEvent.change(input, { target: { value: "New question" } });

    expect(mockOnUpdateText).toHaveBeenCalledWith("New question");
  });

  it("renders required toggle", () => {
    render(<QuestionCard stepSpecification={defaultSpec} />);
    expect(screen.getByText("questionCard.requiredLabel")).toBeInTheDocument();
  });
  it("shows required checkbox as checked when required is true", () => {
    const spec = { ...defaultSpec, required: true };
    render(<QuestionCard stepSpecification={spec} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("calls onToggleRequired when checkbox is clicked", async () => {
    const mockOnToggleRequired = vi.fn();
    render(
      <QuestionCard stepSpecification={defaultSpec} onToggleRequired={mockOnToggleRequired} />,
    );

    const user = userEvent.setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(mockOnToggleRequired).toHaveBeenCalledTimes(1);
  });

  it("renders all answer type options", () => {
    render(<QuestionCard stepSpecification={defaultSpec} />);

    expect(screen.getByText("questionCard.answerTypes.TEXT")).toBeInTheDocument();
    expect(screen.getByText("questionCard.answerTypes.SELECT")).toBeInTheDocument();
    expect(screen.getByText("questionCard.answerTypes.NUMBER")).toBeInTheDocument();
    expect(screen.getByText("questionCard.answerTypes.BOOLEAN")).toBeInTheDocument();
  });

  it("shows TEXT answer type as selected", () => {
    const spec = { ...defaultSpec, answerType: "TEXT" as const };
    render(<QuestionCard stepSpecification={spec} />);

    const textRadio = screen.getByLabelText("questionCard.answerTypes.TEXT");
    expect(textRadio).toBeChecked();
  });

  it("calls onUpdateAnswerType when answer type changes", async () => {
    const mockOnUpdateAnswerType = vi.fn();
    render(
      <QuestionCard stepSpecification={defaultSpec} onUpdateAnswerType={mockOnUpdateAnswerType} />,
    );

    const user = userEvent.setup();
    const selectRadio = screen.getByLabelText("questionCard.answerTypes.SELECT");
    await user.click(selectRadio);

    expect(mockOnUpdateAnswerType).toHaveBeenCalledWith("SELECT");
  });

  it("renders SelectOptionsEditor when answer type is SELECT", () => {
    const spec: QuestionUI = {
      answerType: "SELECT",
      validationMessage: "",
      required: false,
      options: ["Option 1"],
    };
    render(<QuestionCard stepSpecification={spec} />);

    // SelectOptionsEditor should be rendered (check for its content)
    expect(screen.getByText("questionCard.answerOptionsLabel")).toBeInTheDocument();
  });

  it("renders TextAnswerDisplay when answer type is TEXT", () => {
    const spec = { ...defaultSpec, answerType: "TEXT" as const };
    render(<QuestionCard stepSpecification={spec} />);

    expect(screen.getByText("questionCard.textResponseLabel")).toBeInTheDocument();
  });

  it("renders NumberAnswerDisplay when answer type is NUMBER", () => {
    const spec = { ...defaultSpec, answerType: "NUMBER" as const };
    render(<QuestionCard stepSpecification={spec} />);

    expect(screen.getByText("questionCard.numberResponseLabel")).toBeInTheDocument();
  });

  it("renders BooleanAnswerDisplay when answer type is BOOLEAN", () => {
    const spec = { ...defaultSpec, answerType: "BOOLEAN" as const };
    render(<QuestionCard stepSpecification={spec} />);

    expect(screen.getByText("questionCard.booleanResponseLabel")).toBeInTheDocument();
  });

  it("disables all inputs when disabled prop is true", () => {
    render(<QuestionCard stepSpecification={defaultSpec} disabled={true} />);

    const input = screen.getByPlaceholderText("questionCard.placeholder");
    const checkbox = screen.getByRole("checkbox");

    expect(input).toBeDisabled();
    expect(checkbox).toBeDisabled();
  });

  it("passes handlers to SelectOptionsEditor", () => {
    const mockOnAddOption = vi.fn();
    const mockOnUpdateOption = vi.fn();
    const mockOnDeleteOption = vi.fn();
    const mockOnBulkAddOptions = vi.fn();
    const mockOnDeleteAllOptions = vi.fn();

    const spec: QuestionUI = {
      answerType: "SELECT",
      validationMessage: "",
      required: false,
      options: [],
    };

    render(
      <QuestionCard
        stepSpecification={spec}
        onAddOption={mockOnAddOption}
        onUpdateOption={mockOnUpdateOption}
        onDeleteOption={mockOnDeleteOption}
        onBulkAddOptions={mockOnBulkAddOptions}
        onDeleteAllOptions={mockOnDeleteAllOptions}
      />,
    );

    // Verify SelectOptionsEditor is rendered with correct props
    expect(screen.getByText("questionCard.answerOptionsLabel")).toBeInTheDocument();
  });
});
