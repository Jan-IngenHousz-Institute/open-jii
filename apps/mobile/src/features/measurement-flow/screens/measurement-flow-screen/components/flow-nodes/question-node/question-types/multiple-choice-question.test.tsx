import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";

import { MultipleChoiceQuestion } from "./multiple-choice-question";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// FlashList virtualizes via native layout that doesn't exist under Node; render
// each item eagerly so the option buttons are present in the tree.
vi.mock("@shopify/flash-list", () => ({
  FlashList: ({ data, renderItem, keyExtractor }: any) =>
    React.createElement(
      View,
      null,
      (data ?? []).map((item: any, index: number) =>
        React.createElement(
          React.Fragment,
          { key: keyExtractor ? keyExtractor(item, index) : index },
          renderItem({ item, index }),
        ),
      ),
    ),
}));

// lucide-react-native wraps react-native-svg (native); stub the selected-check.
vi.mock("lucide-react-native", () => ({
  Check: () => React.createElement(View),
}));

const makeNode = (options: string[], required = false): FlowNode =>
  ({
    id: "q1",
    name: "q1",
    type: "question",
    content: { kind: "multi_choice", text: "Pick one", options, required },
  }) as FlowNode;

describe("MultipleChoiceQuestion", () => {
  it("renders short options as selectable buttons", () => {
    const onSelect = vi.fn();
    render(
      <MultipleChoiceQuestion
        node={makeNode(["Yes", "No"])}
        selectedValue=""
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByText("Yes"));
    expect(onSelect).toHaveBeenCalledWith("Yes");
  });

  it("renders the full text of long answers without truncation", () => {
    const longAnswer = "I strongly agree with this particular statement about the experiment";
    const onSelect = vi.fn();
    render(
      <MultipleChoiceQuestion
        node={makeNode([longAnswer, "No"])}
        selectedValue=""
        onSelect={onSelect}
      />,
    );

    // The whole answer is present (full-width list layout, no clipping).
    fireEvent.press(screen.getByText(longAnswer));
    expect(onSelect).toHaveBeenCalledWith(longAnswer);
  });

  it("toggles an optional selection off when the active option is pressed again", () => {
    const onSelect = vi.fn();
    render(
      <MultipleChoiceQuestion
        node={makeNode(["Yes", "No"], false)}
        selectedValue="Yes"
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByText("Yes"));
    expect(onSelect).toHaveBeenCalledWith("");
  });
});
