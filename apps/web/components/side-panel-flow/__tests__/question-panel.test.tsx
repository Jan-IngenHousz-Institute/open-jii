import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import type { QuestionUI } from "../../question-card/question-card";
import { QuestionPanel } from "../question-panel";

// Helper to build specs
const makeSpec = (overrides: Partial<QuestionUI> = {}): QuestionUI => ({
  answerType: "TEXT",
  required: false,
  validationMessage: "Init",
  ...overrides,
});

describe("<QuestionPanel />", () => {
  it("renders title and passes initial spec", () => {
    const spec = makeSpec({ answerType: "TEXT", validationMessage: "Hello" });
    render(<QuestionPanel stepSpecification={spec} onChange={() => void 0} disabled={false} />);
    expect(screen.getByText("questionPanel.title")).toBeInTheDocument();
    // Check that the TEXT radio button is checked
    const textRadio = screen.getByRole("radio", { name: "questionCard.answerTypes.TEXT" });
    expect(textRadio).toBeChecked();
  });

  it("updates question text via handler", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    render(<QuestionPanel stepSpecification={makeSpec()} onChange={onChange} disabled={false} />);
    // Find the validation message input and update it
    const input = screen.getByPlaceholderText("questionCard.placeholder");

    const user = userEvent.setup();
    // Type some text - this will append to "Init"
    await user.type(input, "X");

    // Should have been called with updated text
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.validationMessage).toBe("InitX");
  });

  it("switches to SELECT adds options array; switching away removes it", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    const { rerender } = render(
      <QuestionPanel stepSpecification={makeSpec()} onChange={onChange} disabled={false} />,
    );

    const user = userEvent.setup();
    // Click on the SELECT radio button - find by its label
    await user.click(screen.getByText("questionCard.answerTypes.SELECT"));
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

    // Click on the TEXT radio button
    await user.click(screen.getByText("questionCard.answerTypes.TEXT"));
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
    // The toggle is a checkbox, not a button with a name
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ required: true }));
  });

  it("add/update/delete options operate only in SELECT mode", async () => {
    const onChange = vi.fn<(spec: QuestionUI) => void>();
    const baseSelect = makeSpec({ answerType: "SELECT", options: ["A"] });
    const { rerender } = render(
      <QuestionPanel stepSpecification={baseSelect} onChange={onChange} disabled={false} />,
    );

    const user = userEvent.setup();
    // Add option - use translation key
    await user.click(screen.getByRole("button", { name: "questionCard.addOption" }));
    const afterAddCall = onChange.mock.calls.at(-1);
    expect(afterAddCall).toBeDefined();
    const afterAdd = afterAddCall?.[0];
    expect(afterAdd?.options).toEqual(["A", ""]);

    // Update option - test by typing in the text input
    rerender(
      <QuestionPanel
        stepSpecification={{ ...baseSelect, options: ["A", "B"] }}
        onChange={onChange}
        disabled={false}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    const optionInput = inputs[inputs.length - 1]; // Last textbox is the option input
    await user.clear(optionInput);
    await user.type(optionInput, "UPDATED_OPT");
    // Check that onChange was called with updated option
    expect(onChange).toHaveBeenCalled();

    // Delete option - use translation key
    rerender(
      <QuestionPanel
        stepSpecification={{ ...baseSelect, options: ["X", "Y"] }}
        onChange={onChange}
        disabled={false}
      />,
    );
    const deleteButtons = screen.getAllByRole("button", { name: "questionCard.removeOption" });
    await user.click(deleteButtons[0]);
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

    const user = userEvent.setup();
    // Try various operations - these should all be disabled and not call onChange
    const radios = screen.getAllByRole("radio");
    await user.click(radios[0]); // Try to switch answer type

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox); // Try to toggle required

    const addButton = screen.getByRole("button", { name: "questionCard.addOption" });
    await user.click(addButton); // Try to add option

    expect(onChange).not.toHaveBeenCalled();
  });
});
