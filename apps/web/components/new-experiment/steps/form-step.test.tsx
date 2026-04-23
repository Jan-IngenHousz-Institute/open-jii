import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { CreateExperimentBody } from "@repo/api";

import { FormStep } from "./form-step";

function CardA() {
  return <div>Card A</div>;
}

function CardB() {
  return <div>Card B</div>;
}

describe("FormStep", () => {
  const defaultProps = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    stepIndex: 1,
    totalSteps: 4,
  };

  it("renders all provided cards", () => {
    renderWithForm<CreateExperimentBody>(
      (form) => <FormStep {...defaultProps} form={form} cards={[CardA, CardB]} />,
      { useFormProps: { defaultValues: { name: "" } } },
    );
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  it("renders wizard step buttons", () => {
    renderWithForm<CreateExperimentBody>(
      (form) => <FormStep {...defaultProps} form={form} cards={[CardA]} />,
      { useFormProps: { defaultValues: { name: "" } } },
    );
    expect(screen.getByText("experiments.next")).toBeInTheDocument();
    expect(screen.getByText("experiments.back")).toBeInTheDocument();
  });

  it("calls onNext when next button is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderWithForm<CreateExperimentBody>(
      (form) => <FormStep {...defaultProps} onNext={onNext} form={form} cards={[CardA]} />,
      { useFormProps: { defaultValues: { name: "" } } },
    );
    await user.click(screen.getByText("experiments.next"));
    expect(onNext).toHaveBeenCalled();
  });

  it("calls onPrevious when back button is clicked", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    renderWithForm<CreateExperimentBody>(
      (form) => (
        <FormStep
          {...defaultProps}
          stepIndex={2}
          onPrevious={onPrevious}
          form={form}
          cards={[CardA]}
        />
      ),
      { useFormProps: { defaultValues: { name: "" } } },
    );
    await user.click(screen.getByText("experiments.back"));
    expect(onPrevious).toHaveBeenCalled();
  });

  it("renders both cards when given two", () => {
    renderWithForm<CreateExperimentBody>(
      (form) => <FormStep {...defaultProps} form={form} cards={[CardA, CardB]} />,
      { useFormProps: { defaultValues: { name: "" } } },
    );
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  it("renders a single card", () => {
    renderWithForm<CreateExperimentBody>(
      (form) => <FormStep {...defaultProps} form={form} cards={[CardA]} />,
      { useFormProps: { defaultValues: { name: "" } } },
    );
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.queryByText("Card B")).not.toBeInTheDocument();
  });
});
