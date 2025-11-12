// apps/web/components/__tests__/question-card.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { QuestionCard } from "../question-card/question-card";

function renderCard(overrides: Partial<React.ComponentProps<typeof QuestionCard>> = {}) {
  const props: React.ComponentProps<typeof QuestionCard> = {
    stepSpecification: {
      answerType: "TEXT",
      validationMessage: "", // default empty so typing tests are deterministic
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

  const utils = render(<QuestionCard {...props} />);
  return { ...utils, props }; // expose both render utils and the mocks
}

describe("<QuestionCard />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the question input with placeholder and value", () => {
    renderCard({
      stepSpecification: { answerType: "TEXT", validationMessage: "Hello", required: false },
    });
    const input = screen.getByPlaceholderText<HTMLInputElement>("questionCard.placeholder");
    expect(input.value).toBe("Hello");
  });

  it("fires onUpdateText when typing", async () => {
    const { props } = renderCard({
      stepSpecification: { answerType: "TEXT", validationMessage: "", required: false },
    });
    const input = screen.getByPlaceholderText("questionCard.placeholder");

    // because the component is controlled (no rerender), assert single-keystroke payload
    await userEvent.type(input, "a");

    expect(props.onUpdateText).toHaveBeenCalled();
    expect(props.onUpdateText).toHaveBeenLastCalledWith("a");
  });

  it("toggles required via the switch", async () => {
    const { props } = renderCard();
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);
    expect(props.onToggleRequired).toHaveBeenCalledTimes(1);
  });

  it("switches answer type via radios and shows relevant section", async () => {
    const { props } = renderCard({
      stepSpecification: { answerType: "TEXT", required: false },
    });

    // change to SELECT
    await userEvent.click(screen.getByText("questionCard.answerTypes.SELECT"));
    expect(props.onUpdateAnswerType).toHaveBeenCalledWith("SELECT");

    // Re-render in SELECT state and assert presence (no jest-dom needed)
    renderCard({
      stepSpecification: {
        answerType: "SELECT",
        options: [],
        validationMessage: "",
        required: false,
      },
    });
    expect(screen.queryByText("questionCard.answerOptionsLabel")).toBeTruthy();
    expect(screen.queryByText("questionCard.noAnswerOptions")).toBeTruthy();

    // NUMBER section
    renderCard({
      stepSpecification: { answerType: "NUMBER", validationMessage: "", required: false },
    });
    expect(screen.queryByText("questionCard.numberResponseLabel")).toBeTruthy();

    // BOOLEAN section
    renderCard({
      stepSpecification: { answerType: "BOOLEAN", validationMessage: "", required: false },
    });
    expect(screen.queryByText("questionCard.booleanResponseLabel")).toBeTruthy();
  });

  it("renders and edits SELECT options", async () => {
    // Make first option empty so the keystroke equals the expected payload
    const { props } = renderCard({
      stepSpecification: {
        answerType: "SELECT",
        options: ["", "B", "C"],
        validationMessage: "",
        required: false,
      },
    });

    const rows = screen.getAllByRole("textbox");
    const optionInputs = rows.slice(-3);
    expect((optionInputs[0] as HTMLInputElement).value).toBe("");

    // assert single-keystroke wiring due to controlled component without rerender
    await userEvent.type(optionInputs[0], "U");
    expect(props.onUpdateOption).toHaveBeenLastCalledWith(0, "U");

    const removeButtons = screen.getAllByRole("button", { name: /questionCard.removeOption/i });
    await userEvent.click(removeButtons[1]);
    expect(props.onDeleteOption).toHaveBeenCalledWith(1);
  });

  it("calls onAddOption when clicking Add option", async () => {
    const { props } = renderCard({
      stepSpecification: {
        answerType: "SELECT",
        options: [],
        validationMessage: "",
        required: false,
      },
    });

    const addBtn = screen.getByRole("button", { name: "questionCard.addOption" });
    await userEvent.click(addBtn);

    expect(props.onAddOption).toHaveBeenCalledTimes(1);
  });

  it("respects disabled state across inputs", () => {
    renderCard({
      disabled: true,
      stepSpecification: {
        answerType: "SELECT",
        options: ["A"],
        required: true,
        validationMessage: "Q",
      },
    });

    const qInput = screen.getByPlaceholderText("questionCard.placeholder");
    const requiredCheckbox = screen.getByRole("checkbox");
    const addBtn = screen.getByRole("button", { name: "questionCard.addOption" });
    const optInput = screen.getAllByRole("textbox").at(-1);

    // no jest-dom: assert .disabled flags directly
    expect((qInput as HTMLInputElement).disabled).toBe(true);
    expect((requiredCheckbox as HTMLInputElement).disabled).toBe(true);
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    expect((optInput as HTMLInputElement | undefined)?.disabled).toBe(true);
  });
});
