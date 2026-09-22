import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { NumberAnswerDisplay } from "./number-answer-display";

describe("NumberAnswerDisplay", () => {
  it("renders the number response label", () => {
    render(<NumberAnswerDisplay />);
    expect(screen.getByText("questionCard.numberResponseLabel")).toBeInTheDocument();
  });

  it("renders the number response description", () => {
    render(<NumberAnswerDisplay />);
    expect(screen.getByText("questionCard.numberResponseDescription")).toBeInTheDocument();
  });

  it("displays the number icon", () => {
    render(<NumberAnswerDisplay />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("wears the published tone's wash", () => {
    const { container } = render(<NumberAnswerDisplay />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("bg-status-published");
  });
});
