import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { QuestionUI } from "../../question-card";
import { QuestionPanel } from "../question-panel";

// i18n mock
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Capture last props passed to mocked QuestionCard
interface MockQuestionCardProps {
  stepSpecification: QuestionUI;
  onUpdateText?: (text: string) => void;
  onUpdateAnswerType?: (answerType: QuestionUI["answerType"]) => void;
  onToggleRequired?: () => void;
  onAddOption?: () => void;
  onUpdateOption?: (index: number, text: string) => void;
  onDeleteOption?: (index: number) => void;
  disabled?: boolean;
}

let lastQuestionCardProps: MockQuestionCardProps | null = null;
vi.mock("../../question-card", () => ({
  QuestionCard: (props: MockQuestionCardProps) => {
    lastQuestionCardProps = props;
    return (
      <div data-testid="question-card-mock">
        <button type="button" onClick={() => props.onUpdateText?.("NEW_TEXT")}>
          trigger-text
        </button>
        <button type="button" onClick={() => props.onUpdateAnswerType?.("SELECT")}>
          to-select
        </button>
        <button type="button" onClick={() => props.onUpdateAnswerType?.("TEXT")}>
          to-text
        </button>
        <button type="button" onClick={() => props.onUpdateAnswerType?.("NUMBER")}>
          to-number
        </button>
        <button type="button" onClick={() => props.onUpdateAnswerType?.("BOOLEAN")}>
          to-boolean
        </button>
        <button type="button" onClick={() => props.onToggleRequired?.()}>
          toggle-required
        </button>
        <button type="button" onClick={() => props.onAddOption?.()}>
          add-option
        </button>
        <button type="button" onClick={() => props.onUpdateOption?.(1, "UPDATED_OPT")}>
          update-opt-1
        </button>
        <button type="button" onClick={() => props.onDeleteOption?.(0)}>
          delete-opt-0
        </button>
      </div>
    );
  },
}));

// Helper to build specs
const makeSpec = (overrides: Partial<QuestionUI> = {}): QuestionUI => ({
  answerType: "TEXT",
  required: false,
  validationMessage: "Init",
  ...overrides,
});

describe("<QuestionPanel />", () => {
  beforeEach(() => {
    lastQuestionCardProps = null;
  });

  it("renders title and passes initial spec", () => {
    const spec = makeSpec({ answerType: "TEXT", validationMessage: "Hello" });
    render(<QuestionPanel stepSpecification={spec} onChange={() => void 0} disabled={false} />);
    expect(screen.getByText("questionPanel.title")).toBeInTheDocument();
    expect(lastQuestionCardProps?.stepSpecification.answerType).toBe("TEXT");
    expect(lastQuestionCardProps?.stepSpecification.validationMessage).toBe("Hello");
  });

  it("updates question text via handler", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    render(<QuestionPanel stepSpecification={makeSpec()} onChange={onChange} disabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger-text" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ validationMessage: "NEW_TEXT" }),
    );
  });

  it("switches to SELECT adds options array; switching away removes it", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    const { rerender } = render(
      <QuestionPanel stepSpecification={makeSpec()} onChange={onChange} disabled={false} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "to-select" }));
    const firstCallArr = onChange.mock.calls.at(-1);
    expect(firstCallArr).toBeDefined();
    const firstCall = firstCallArr?.[0];
    expect(firstCall?.answerType).toBe("SELECT");
    expect(firstCall?.options).toEqual([]); // created empty array

    // Rerender with a SELECT spec containing options to test removal
    rerender(
      <QuestionPanel
        stepSpecification={makeSpec({ answerType: "SELECT", options: ["A", "B"] })}
        onChange={onChange}
        disabled={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "to-text" }));
    const secondCall = onChange.mock.calls.at(-1)?.[0];
    expect(secondCall).toBeDefined();
    expect(secondCall?.answerType).toBe("TEXT");
    // options property should be removed
    expect(secondCall && Object.prototype.hasOwnProperty.call(secondCall, "options")).toBe(false);
  });

  it("toggle required flips flag", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    render(
      <QuestionPanel
        stepSpecification={makeSpec({ required: false })}
        onChange={onChange}
        disabled={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "toggle-required" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ required: true }));
  });

  it("add/update/delete options operate only in SELECT mode", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    const baseSelect = makeSpec({ answerType: "SELECT", options: ["A"] });
    const { rerender } = render(
      <QuestionPanel stepSpecification={baseSelect} onChange={onChange} disabled={false} />,
    );

    // Add option
    await userEvent.click(screen.getByRole("button", { name: "add-option" }));
    const afterAddCall = onChange.mock.calls.at(-1);
    expect(afterAddCall).toBeDefined();
    const afterAdd = afterAddCall?.[0];
    expect(afterAdd?.options).toEqual(["A", ""]);

    // Update option index 1
    rerender(
      <QuestionPanel
        stepSpecification={{ ...baseSelect, options: ["A", "B"] }}
        onChange={onChange}
        disabled={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "update-opt-1" }));
    const afterUpdateCall = onChange.mock.calls.at(-1);
    expect(afterUpdateCall).toBeDefined();
    const afterUpdate = afterUpdateCall?.[0];
    expect(afterUpdate?.options).toEqual(["A", "UPDATED_OPT"]);

    // Delete option 0
    rerender(
      <QuestionPanel
        stepSpecification={{ ...baseSelect, options: ["X", "Y"] }}
        onChange={onChange}
        disabled={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "delete-opt-0" }));
    const afterDeleteCall = onChange.mock.calls.at(-1);
    expect(afterDeleteCall).toBeDefined();
    const afterDelete = afterDeleteCall?.[0];
    expect(afterDelete?.options).toEqual(["Y"]);
  });

  it("handlers are no-ops when disabled", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    render(
      <QuestionPanel
        stepSpecification={makeSpec({ answerType: "SELECT" })}
        onChange={onChange}
        disabled
      />,
    );

    // Try various operations
    await userEvent.click(screen.getByRole("button", { name: "trigger-text" }));
    await userEvent.click(screen.getByRole("button", { name: "to-number" }));
    await userEvent.click(screen.getByRole("button", { name: "toggle-required" }));
    await userEvent.click(screen.getByRole("button", { name: "add-option" }));
    await userEvent.click(screen.getByRole("button", { name: "update-opt-1" }));
    await userEvent.click(screen.getByRole("button", { name: "delete-opt-0" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
