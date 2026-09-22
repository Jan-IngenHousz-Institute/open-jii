import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationReadStep } from "./calibration-read-step";
import type { ReadSource } from "./rig-sources";

type ReadStep = Extract<ProcedureStep, { kind: "read" }>;

const SOURCES: ReadSource[] = [
  { role: "dut", offered: ["par_raw", "par"], isExhaustive: false },
  { role: "par_ref", offered: ["par"], isExhaustive: true },
];

function readStep(overrides: Partial<ReadStep> = {}): ReadStep {
  return {
    kind: "read",
    series: "dark",
    read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
    ...overrides,
  };
}

function renderStep(props: Partial<Parameters<typeof CalibrationReadStep>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <CalibrationReadStep
      step={readStep()}
      sources={SOURCES}
      takenSeries={["dark"]}
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("CalibrationReadStep", () => {
  it("names the series the readings land in and lists what is read", () => {
    renderStep();

    expect(screen.getByLabelText("iot.calibration.procedure.series")).toHaveValue("dark");
    expect(screen.getByLabelText("iot.calibration.procedure.command")).toHaveValue("par_raw");
  });

  it("renames the series", async () => {
    const { onChange } = renderStep();

    const series = screen.getByLabelText("iot.calibration.procedure.series");
    await userEvent.clear(series);
    await userEvent.type(series, "ambient");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ series: "ambient" }));
  });

  it("carries a prompt that tells the operator how to set the bench up", async () => {
    const { onChange } = renderStep({ step: readStep({ prompt: "Lid shut" }) });

    await userEvent.type(screen.getByLabelText("iot.calibration.procedure.prompt"), "!");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: "Lid shut!" }));
  });

  // The contract has no word for an empty prompt, and a blank one would stop the run for nothing.
  it("drops the prompt rather than storing an empty one", async () => {
    const { onChange } = renderStep({ step: readStep({ prompt: "L" }) });

    await userEvent.clear(screen.getByLabelText("iot.calibration.procedure.prompt"));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: undefined }));
  });

  it("locks the step on a definition a run has closed", () => {
    renderStep({ canEdit: false });

    expect(screen.getByLabelText("iot.calibration.procedure.prompt")).toBeDisabled();
    expect(screen.getByLabelText("iot.calibration.procedure.series")).toBeDisabled();
  });
});
