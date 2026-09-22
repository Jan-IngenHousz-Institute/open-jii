import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationSweepStep } from "./calibration-sweep-step";
import type { ReadSource, SetpointTarget } from "./rig-sources";

type SweepStep = Extract<ProcedureStep, { kind: "sweep" }>;

const SOURCES: ReadSource[] = [{ role: "dut", offered: ["par_raw"], isExhaustive: false }];

const TARGETS: SetpointTarget[] = [
  {
    role: "lamp",
    setpoints: [
      { name: "current_a", unit: "A", min: 0, max: 6.6, integer: false },
      { name: "voltage_v", unit: "V", min: 0, max: 30, integer: false },
    ],
  },
];

function sweep(overrides: Partial<SweepStep> = {}): SweepStep {
  return {
    kind: "sweep",
    series: "par_sweep",
    stimulus: { instrument: "lamp", set: "current_a", values: [0, 0.8, 2.4] },
    read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
    ...overrides,
  };
}

function renderSweep(props: Partial<Parameters<typeof CalibrationSweepStep>[0]> = {}) {
  const onChange = vi.fn<(step: ProcedureStep) => void>();
  render(
    <CalibrationSweepStep
      step={sweep()}
      sources={SOURCES}
      targets={TARGETS}
      takenSeries={["par_sweep"]}
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("CalibrationSweepStep", () => {
  // These are the numbers the instrument will accept, and a sweep is written by typing numbers.
  it("puts the instrument's range beside the setpoint it drives", () => {
    renderSweep();

    expect(screen.getByText("0…6.6 A")).toBeInTheDocument();
  });

  it("asks the operator for a prompt when nobody is driving the stimulus", () => {
    renderSweep({
      step: sweep({ stimulus: { operator: "Swap the ND filter", values: ["ND1", "ND2"] } }),
    });

    expect(screen.getByLabelText("iot.calibration.procedure.operatorPrompt")).toHaveValue(
      "Swap the ND filter",
    );
    expect(screen.queryByText("iot.calibration.procedure.setpoint")).toBeNull();
  });

  it("marks an operator sweep with no prompt invalid", () => {
    renderSweep({ step: sweep({ stimulus: { operator: "  ", values: ["a"] } }) });

    expect(screen.getByLabelText("iot.calibration.procedure.operatorPrompt")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("carries the prompt the author typed", async () => {
    const { onChange } = renderSweep({
      step: sweep({ stimulus: { operator: "Swap", values: ["a"] } }),
    });

    await userEvent.type(screen.getByLabelText("iot.calibration.procedure.operatorPrompt"), "!");

    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next).toMatchObject({ stimulus: { operator: "Swap!" } });
  });

  // An instrument takes numbers, so the labels an operator was reading cannot survive the swap.
  it("drops the labels when an operator sweep is handed to an instrument", async () => {
    const { onChange } = renderSweep({
      step: sweep({ stimulus: { operator: "Swap", values: ["ND1", 0.5] } }),
    });

    await userEvent.click(screen.getByLabelText("iot.calibration.procedure.driven"));
    await userEvent.click(await screen.findByRole("option", { name: "lamp" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stimulus: { instrument: "lamp", set: "current_a", values: [0.5] },
      }),
    );
  });

  it("keeps the points when the instrument's setpoint changes", async () => {
    const { onChange } = renderSweep();

    await userEvent.click(screen.getByLabelText("iot.calibration.procedure.setpoint"));
    await userEvent.click(await screen.findByRole("option", { name: "voltage_v" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stimulus: { instrument: "lamp", set: "voltage_v", values: [0, 0.8, 2.4] },
      }),
    );
  });

  it("locks the stimulus on a definition a run has closed", () => {
    renderSweep({ canEdit: false });

    expect(screen.getByLabelText("iot.calibration.procedure.driven")).toBeDisabled();
  });
});
