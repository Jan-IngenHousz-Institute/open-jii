import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { QuestionCard } from "../question-card/question-card";

function renderCard(overrides: Partial<React.ComponentProps<typeof QuestionCard>> = {}) {
  const props: React.ComponentProps<typeof QuestionCard> = {
    stepSpecification: {
      answerType: "TEXT",
      validationMessage: "",
      required: false,
      ...(overrides.stepSpecification ?? {}),
    },
    onUpdateText: vi.fn(),
    onUpdateAnswerType: vi.fn(),
    onToggleRequired: vi.fn(),
    onAddOption: vi.fn(),
    onUpdateOption: vi.fn(),
    onDeleteOption: vi.fn(),
    disabled: false,
    ...overrides,
  };
  return { ...render(<QuestionCard {...props} />), props };
}

describe("QuestionCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders question input with value", () => {
    renderCard({
      stepSpecification: { answerType: "TEXT", validationMessage: "Hello", required: false },
    });
    expect(screen.getByPlaceholderText<HTMLInputElement>("questionCard.placeholder").value).toBe(
      "Hello",
    );
  });

  it("fires onUpdateText when typing", async () => {
    const { props } = renderCard();
    await userEvent.setup().type(screen.getByPlaceholderText("questionCard.placeholder"), "a");
    expect(props.onUpdateText).toHaveBeenLastCalledWith("a");
  });

  it("toggles required via the checkbox", async () => {
    const { props } = renderCard();
    await userEvent.setup().click(screen.getByRole("checkbox"));
    expect(props.onToggleRequired).toHaveBeenCalledTimes(1);
  });

  it("switches answer type and shows relevant section", async () => {
    const { props } = renderCard();
    await userEvent.setup().click(screen.getByText("questionCard.answerTypes.SELECT"));
    expect(props.onUpdateAnswerType).toHaveBeenCalledWith("SELECT");

    // Re-render in SELECT mode
    renderCard({
      stepSpecification: {
        answerType: "SELECT",
        options: [],
        validationMessage: "",
        required: false,
      },
    });
    expect(screen.queryByText("questionCard.noAnswerOptions")).toBeTruthy();

    renderCard({
      stepSpecification: { answerType: "BOOLEAN", validationMessage: "", required: false },
    });
    expect(screen.queryByText("questionCard.booleanResponseLabel")).toBeTruthy();
  });

  it("renders and edits SELECT options", async () => {
    const user = userEvent.setup();
    const { props } = renderCard({
      stepSpecification: {
        answerType: "SELECT",
        options: ["", "B", "C"],
        validationMessage: "",
        required: false,
      },
    });

    const optionInputs = screen.getAllByRole("textbox").slice(-3);
    await user.type(optionInputs[0], "U");
    expect(props.onUpdateOption).toHaveBeenLastCalledWith(0, "U");

    await user.click(screen.getAllByRole("button", { name: /questionCard.removeOption/i })[1]);
    expect(props.onDeleteOption).toHaveBeenCalledWith(1);
  });

  it("respects disabled state", () => {
    renderCard({
      disabled: true,
      stepSpecification: {
        answerType: "SELECT",
        options: ["A"],
        required: true,
        validationMessage: "Q",
      },
    });
    expect(
      (screen.getByPlaceholderText("questionCard.placeholder") as HTMLInputElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "questionCard.addOption" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
