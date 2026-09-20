import { render, screen } from "@testing-library/react";
import React from "react";

import { WizardStepIndicator } from "../wizard-step-indicator";

const STEPS = ["Details", "Code & Test", "Review"];

describe("WizardStepIndicator", () => {
  it("numbers every step and shows its title", () => {
    render(<WizardStepIndicator steps={STEPS} currentIndex={0} />);

    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Code & Test")).toBeDefined();
  });

  it("marks the current step and fills the line behind the completed ones", () => {
    const { container } = render(<WizardStepIndicator steps={STEPS} currentIndex={1} />);

    const current = container.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("2");
    expect(screen.getByText("1")).toHaveClass("bg-primary/80");
    expect(screen.getByText("3")).toHaveClass("bg-background");

    // One connector per gap: the first is behind the current step, the second ahead of it.
    const connectors = container.querySelectorAll(".bg-primary\\/80.absolute");
    expect(connectors).toHaveLength(2);
    expect(connectors[0]).toHaveClass("w-full");
    expect(connectors[1]).toHaveClass("w-0");
  });

  it("can show the circles alone", () => {
    render(<WizardStepIndicator steps={STEPS} currentIndex={0} showTitles={false} />);

    expect(screen.queryByText("Details")).toBeNull();
  });
});
