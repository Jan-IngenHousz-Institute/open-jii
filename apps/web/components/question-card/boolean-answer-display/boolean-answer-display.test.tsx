import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { BooleanAnswerDisplay } from "./boolean-answer-display";

describe("BooleanAnswerDisplay", () => {
  it("renders the boolean response label", () => {
    render(<BooleanAnswerDisplay />);
    expect(screen.getByText("questionCard.booleanResponseLabel")).toBeInTheDocument();
  });

  it("renders the boolean response description", () => {
    render(<BooleanAnswerDisplay />);
    expect(screen.getByText("questionCard.booleanResponseDescription")).toBeInTheDocument();
  });

  it("displays the checkmark icon", () => {
    const { container } = render(<BooleanAnswerDisplay />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has green gradient styling", () => {
    const { container } = render(<BooleanAnswerDisplay />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("from-green-50", "to-green-100");
  });
});
