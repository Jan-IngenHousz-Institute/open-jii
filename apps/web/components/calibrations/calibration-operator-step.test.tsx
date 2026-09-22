import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationOperatorStep } from "./calibration-operator-step";

type OperatorStep = Extract<ProcedureStep, { kind: "operator" }>;

function operatorStep(overrides: Partial<OperatorStep> = {}): OperatorStep {
  return { kind: "operator", prompt: "Close the lid", ...overrides };
}

function renderStep(step = operatorStep(), canEdit = true) {
  const onChange = vi.fn();
  render(<CalibrationOperatorStep step={step} canEdit={canEdit} onChange={onChange} />);
  return { onChange };
}

describe("CalibrationOperatorStep", () => {
  it("shows the prompt and the word that gates the step", () => {
    renderStep(operatorStep({ confirm: "DARK" }));

    expect(screen.getByDisplayValue("Close the lid")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DARK")).toBeInTheDocument();
  });

  it("marks an empty prompt invalid, since a step that asks nothing blocks the run for nothing", () => {
    renderStep(operatorStep({ prompt: "  " }));

    expect(screen.getByLabelText("iot.calibration.procedure.prompt")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("reports what the author typed into the prompt", async () => {
    const { onChange } = renderStep();

    await userEvent.type(screen.getByLabelText("iot.calibration.procedure.prompt"), "!");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ prompt: "Close the lid!" }),
    );
  });

  // A blank confirm is no gate at all, and the contract has no word for "gate on nothing".
  it("drops the confirmation word rather than storing an empty one", async () => {
    const { onChange } = renderStep(operatorStep({ confirm: "D" }));

    await userEvent.clear(screen.getByLabelText("iot.calibration.procedure.confirm"));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ confirm: undefined }));
  });

  it("locks both fields on a definition that can no longer be edited", () => {
    renderStep(operatorStep({ confirm: "DARK" }), false);

    expect(screen.getByLabelText("iot.calibration.procedure.prompt")).toBeDisabled();
    expect(screen.getByLabelText("iot.calibration.procedure.confirm")).toBeDisabled();
  });
});
