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
    render(<TextAnswerDisplay />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has the correct styling classes", () => {
    const { container } = render(<TextAnswerDisplay />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("bg-accent", "rounded-lg", "p-6", "text-center");
  });
});
