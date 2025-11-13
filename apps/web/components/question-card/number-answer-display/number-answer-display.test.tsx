import { render, screen } from "@testing-library/react";
import React from "react";
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
    const { container } = render(<NumberAnswerDisplay />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("has blue gradient styling", () => {
    const { container } = render(<NumberAnswerDisplay />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("from-blue-50", "to-blue-100");
  });
});
