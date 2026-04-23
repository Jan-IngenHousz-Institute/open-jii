import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { QuestionCell } from "@repo/api";

import { QuestionCellComponent } from "./question-cell";

function makeQuestionCell(overrides: Partial<QuestionCell> = {}): QuestionCell {
  return {
    id: "q-1",
    type: "question",
    question: { kind: "open_ended", text: "", required: false },
    isCollapsed: false,
    isAnswered: false,
    ...overrides,
  };
}

function renderQuestion(
  overrides: Partial<QuestionCell> = {},
  props: Partial<React.ComponentProps<typeof QuestionCellComponent>> = {},
) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onRun = vi.fn();
  const onQuestionAnswered = vi.fn();
  const cell = makeQuestionCell(overrides);
  const result = render(
    <QuestionCellComponent
      cell={cell}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onRun={onRun}
      onQuestionAnswered={onQuestionAnswered}
      {...props}
    />,
  );
  return { ...result, onUpdate, onDelete, onRun, onQuestionAnswered, cell };
}

describe("QuestionCellComponent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows all four question kind buttons", () => {
    renderQuestion();
    expect(screen.getByText("Yes / No")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Choice")).toBeInTheDocument();
    expect(screen.getByText("Number")).toBeInTheDocument();
  });

  it("lets the user type a question", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderQuestion();

    await user.type(screen.getByPlaceholderText("Type your question here..."), "W");

    // Controlled input: first keystroke fires onUpdate with "W"
    const firstCall = onUpdate.mock.calls[0][0] as QuestionCell;
    expect(firstCall.question.text).toBe("W");
  });

  it("switches kind when the user clicks a different kind button", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderQuestion();

    await user.click(screen.getByText("Yes / No"));
    const updated = onUpdate.mock.calls[0][0] as QuestionCell;
    expect(updated.question.kind).toBe("yes_no");
  });

  it("shows multi-choice options when kind is multi_choice", () => {
    renderQuestion({
      question: {
        kind: "multi_choice",
        text: "Pick one",
        required: false,
        options: ["Red", "Blue", "Green"],
      },
    });
    expect(screen.getByDisplayValue("Red")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Blue")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Green")).toBeInTheDocument();
  });

  it("lets the user add an option in multi-choice mode", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderQuestion({
      question: {
        kind: "multi_choice",
        text: "Pick one",
        required: false,
        options: ["Red"],
      },
    });

    await user.click(screen.getByRole("button", { name: /add option/i }));
    const updated = onUpdate.mock.calls[0][0] as QuestionCell;
    expect(updated.question.kind === "multi_choice" && updated.question.options).toHaveLength(2);
  });

  it("toggles the required switch", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderQuestion();

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    const updated = onUpdate.mock.calls[0][0] as QuestionCell;
    expect(updated.question.required).toBe(true);
  });

  it("opens the answer dialog via promptOpen and lets the user type and submit", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderQuestion(
      { question: { kind: "open_ended", text: "What is your name?", required: false } },
      { promptOpen: true },
    );

    // The answer dialog should be open showing the question
    expect(screen.getByText("What is your name?")).toBeInTheDocument();

    // Type an answer and submit
    await user.type(screen.getByPlaceholderText("Type your answer..."), "Alice");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    const updated = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as QuestionCell;
    expect(updated.answer).toBe("Alice");
    expect(updated.isAnswered).toBe(true);
  });

  it("opens the answer dialog automatically when promptOpen is true", () => {
    renderQuestion(
      { question: { kind: "yes_no", text: "Continue?", required: false } },
      { promptOpen: true },
    );
    expect(screen.getByText("Continue?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("disables submit when required and answer is empty", () => {
    renderQuestion(
      { question: { kind: "open_ended", text: "Name?", required: true } },
      { promptOpen: true },
    );
    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });

  describe("readOnly mode", () => {
    it("disables the question text input", () => {
      renderQuestion({}, { readOnly: true });
      const input = screen.getByPlaceholderText("Type your question here...");
      expect(input).toBeDisabled();
    });

    it("hides the required switch (hidden via headerActions)", () => {
      renderQuestion({}, { readOnly: true });
      // CellWrapper hides headerActions in readOnly mode, so the switch is not in the DOM
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("disables the kind selector buttons", () => {
      renderQuestion({}, { readOnly: true });
      const yesNoButton = screen.getByText("Yes / No").closest("button");
      expect(yesNoButton).toBeDisabled();
    });

    it("disables multi-choice option inputs and hides add/remove buttons", () => {
      renderQuestion(
        {
          question: {
            kind: "multi_choice",
            text: "Pick one",
            required: false,
            options: ["Red", "Blue"],
          },
        },
        { readOnly: true },
      );
      expect(screen.getByDisplayValue("Red")).toBeDisabled();
      expect(screen.getByDisplayValue("Blue")).toBeDisabled();
      expect(screen.queryByRole("button", { name: /add option/i })).not.toBeInTheDocument();
    });
  });
});
