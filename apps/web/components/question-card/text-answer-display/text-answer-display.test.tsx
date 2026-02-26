import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { TextAnswerDisplay } from "./text-answer-display";

describe("TextAnswerDisplay", () => {
  it("renders the text response label", () => {
    render(<TextAnswerDisplay />);
    expect(screen.getByText("questionCard.textResponseLabel")).toBeInTheDocument();
  });

  it("renders the text response description", () => {
    render(<TextAnswerDisplay />);
    expect(screen.getByText("questionCard.textResponseDescription")).toBeInTheDocument();
  });

  it("displays the edit icon", () => {
    const { container } = render(<TextAnswerDisplay />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has the correct styling classes", () => {
    const { container } = render(<TextAnswerDisplay />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("rounded-lg", "bg-gradient-to-r", "p-6", "text-center");
  });
});
