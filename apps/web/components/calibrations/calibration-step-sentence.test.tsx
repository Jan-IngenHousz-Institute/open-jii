import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureStep } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationStepSentence } from "./calibration-step-sentence";
import type { ReadSource, SetpointTarget } from "./rig-sources";

const SOURCES: ReadSource[] = [
  { role: "dut", offered: ["hello", "get_par"], isExhaustive: false },
  { role: "par_ref", offered: ["par"], isExhaustive: true },
];

const TARGETS: SetpointTarget[] = [
  {
    role: "lamp",
    setpoints: [
      { name: "current_a", unit: "A", min: 0, max: 10, integer: false },
      { name: "voltage_v", unit: "V", min: 0, max: 32, integer: false },
    ],
  },
  {
    role: "dut",
    setpoints: [{ name: "led_setting", unit: "step", min: 0, max: 255, integer: true }],
  },
];

function renderSentence(
  step: ProcedureStep,
  props: Partial<Parameters<typeof CalibrationStepSentence>[0]> = {},
) {
  const onChange = vi.fn<(step: ProcedureStep) => void>();
  const { container } = render(
    <CalibrationStepSentence
      step={step}
      sources={SOURCES}
      targets={TARGETS}
      takenSeries={"series" in step ? [step.series] : []}
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { container, onChange, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

/** A value reads as text until it is clicked, so a test reaches one the way a person does. */
async function retype(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.click(screen.getByRole("button", { name: label }));
  const field = screen.getByRole("textbox", { name: label });
  await user.clear(field);
  if (text !== "") {
    await user.type(field, text);
  }
  await user.tab();
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string | RegExp,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("CalibrationStepSentence", () => {
  describe("an operator step", () => {
    const operator: ProcedureStep = { kind: "operator", prompt: "Aim the lamp" };

    it("rewrites what the operator is asked", async () => {
      const { onChange, user } = renderSentence(operator);

      await retype(user, "iot.calibration.procedure.prompt", "Cover the sensor");

      expect(onChange).toHaveBeenLastCalledWith({ ...operator, prompt: "Cover the sensor" });
    });

    it("marks a prompt left empty, since the operator would be asked nothing", () => {
      renderSentence({ kind: "operator", prompt: " " });

      expect(screen.getByRole("button", { name: "iot.calibration.procedure.prompt" })).toHaveClass(
        "text-destructive",
      );
    });

    it("drops the word the operator types to go on once it is cleared", async () => {
      const { onChange, user } = renderSentence({ ...operator, confirm: "DARK" });

      await retype(user, "iot.calibration.procedure.confirm", "");

      expect(onChange).toHaveBeenLastCalledWith({ ...operator, confirm: undefined });
    });
  });

  describe("a settle step", () => {
    const settle: ProcedureStep = { kind: "settle", ms: 1000 };

    it("waits for as long as it is told", async () => {
      const { onChange, user } = renderSentence(settle);

      await retype(user, "iot.calibration.procedure.waitFor", "250");

      expect(onChange).toHaveBeenLastCalledWith({ kind: "settle", ms: 250 });
    });

    it("says what a wait must be while it is typed", async () => {
      const { user } = renderSentence(settle);

      await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.waitFor" }));
      const field = screen.getByRole("textbox", { name: "iot.calibration.procedure.waitFor" });
      await user.clear(field);
      await user.type(field, "0");

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "iot.calibration.invalid.wholeRange",
      );
    });

    it("keeps its wait when the new one is not a whole number the contract allows", async () => {
      const { onChange, user } = renderSentence(settle);

      await retype(user, "iot.calibration.procedure.waitFor", "0");
      await retype(user, "iot.calibration.procedure.waitFor", "a while");

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("a set step", () => {
    const set: ProcedureStep = { kind: "set", instrument: "lamp", set: "current_a", value: 0 };

    it("reads the unit of the setpoint it drives", () => {
      const { container } = renderSentence(set);

      expect(container).toHaveTextContent("A");
    });

    it("moves to another instrument on that instrument's first setpoint", async () => {
      const { onChange, user } = renderSentence(set);

      await choose(user, "iot.calibration.procedure.driven", "dut");

      expect(onChange).toHaveBeenLastCalledWith({ ...set, instrument: "dut", set: "led_setting" });
    });

    it("offers each setpoint with the span it can be driven across", async () => {
      const { onChange, user } = renderSentence(set);

      await user.click(
        screen.getByRole("combobox", { name: "iot.calibration.procedure.setpoint" }),
      );
      const option = await screen.findByRole("option", { name: /voltage_v/ });
      expect(option).toHaveTextContent("32");
      await user.click(option);

      expect(onChange).toHaveBeenLastCalledWith({ ...set, set: "voltage_v" });
    });

    // An empty value would read as 0 and drive the instrument there without a word.
    it("refuses a value left empty", async () => {
      const { onChange, user } = renderSentence(set);

      await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.value" }));
      await user.clear(screen.getByRole("textbox", { name: "iot.calibration.procedure.value" }));

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "iot.calibration.invalid.number",
      );
      await user.tab();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("takes a value only once it is a number", async () => {
      const { onChange, user } = renderSentence(set);

      await retype(user, "iot.calibration.procedure.value", "full");
      expect(onChange).not.toHaveBeenCalled();

      await retype(user, "iot.calibration.procedure.value", "2.5");
      expect(onChange).toHaveBeenLastCalledWith({ ...set, value: 2.5 });
    });
  });

  describe("a read step", () => {
    const read: ProcedureStep = {
      kind: "read",
      series: "dark",
      read: [{ instrument: "dut", command: "hello", as: "reply" }],
    };

    it("renames the series the fit will look it up by", async () => {
      const { onChange, user } = renderSentence(read);

      await retype(user, "iot.calibration.procedure.series", "baseline");

      expect(onChange).toHaveBeenLastCalledWith({ ...read, series: "baseline" });
    });

    // takenSeries carries this step's own series too, so a collision is the name twice.
    it("marks a series another step already produces", () => {
      renderSentence(read, { takenSeries: ["dark", "dark"] });

      expect(screen.getByRole("button", { name: "iot.calibration.procedure.series" })).toHaveClass(
        "text-destructive",
      );
    });

    it("refuses the suffix that names an operator's retaken readings", async () => {
      const { onChange, user } = renderSentence(read);

      await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.series" }));
      const field = screen.getByRole("textbox", { name: "iot.calibration.procedure.series" });
      await user.clear(field);
      await user.type(field, "dark_retaken");

      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "iot.calibration.procedure.seriesReserved",
      );
      await user.tab();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("marks a series name the fit could not index by", () => {
      renderSentence({ ...read, series: "Dark Series" });

      expect(screen.getByRole("button", { name: "iot.calibration.procedure.series" })).toHaveClass(
        "text-destructive",
      );
    });

    it("edits what the reads record from inside the sentence", async () => {
      const { onChange, user } = renderSentence(read);

      await retype(user, "iot.calibration.procedure.column", "counts");

      expect(onChange).toHaveBeenLastCalledWith({
        ...read,
        read: [{ instrument: "dut", command: "hello", as: "counts" }],
      });
    });

    it("rewrites the operator's setup prompt, and drops it once cleared", async () => {
      const prompted: ProcedureStep = { ...read, prompt: "Cover the sensor" };
      const { onChange, user } = renderSentence(prompted);

      await retype(user, "iot.calibration.procedure.prompt", "Uncover it");
      expect(onChange).toHaveBeenLastCalledWith({ ...prompted, prompt: "Uncover it" });

      await retype(user, "iot.calibration.procedure.prompt", "");
      expect(onChange).toHaveBeenLastCalledWith({ ...prompted, prompt: undefined });
    });
  });

  describe("a sweep the operator drives", () => {
    const sweep: ProcedureStep = {
      kind: "sweep",
      series: "levels",
      settleMs: 1000,
      stimulus: { operator: "Set the dial to {value}", values: [1, "dim"] },
      read: [{ instrument: "dut", command: "hello", as: "reply" }],
    };

    it("keeps labels among its points, since the operator reads them", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.values", "1, dim, bright");

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { operator: "Set the dial to {value}", values: [1, "dim", "bright"] },
      });
    });

    it("leaves its points alone while the list is still being typed", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.values", " , ");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("rewrites what the operator is told at each point", async () => {
      const { onChange, user } = renderSentence(sweep);

      // user-event reads a lone brace as a key name, so "{{" types a literal one.
      await retype(user, "iot.calibration.procedure.operatorPrompt", "Turn to {{value}");

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { operator: "Turn to {value}", values: [1, "dim"] },
      });
    });

    it("settles for as long as it is told, and not at all once cleared", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.settleFor", "300");
      expect(onChange).toHaveBeenLastCalledWith({ ...sweep, settleMs: 300 });

      await retype(user, "iot.calibration.procedure.settleFor", "");
      expect(onChange).toHaveBeenLastCalledWith({ ...sweep, settleMs: undefined });
    });

    it.each(["-1", "1.5", "600001"])(
      "refuses a settle of %s, which the contract does not allow",
      async (entered) => {
        const { onChange, user } = renderSentence(sweep);

        await retype(user, "iot.calibration.procedure.settleFor", entered);

        expect(onChange).not.toHaveBeenCalled();
      },
    );

    it("takes a settle of zero, which the contract allows", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.settleFor", "0");

      expect(onChange).toHaveBeenLastCalledWith({ ...sweep, settleMs: 0 });
    });

    it("hands the sweep back to an instrument, on its first setpoint", async () => {
      const { onChange, user } = renderSentence(sweep);

      await choose(user, "iot.calibration.procedure.driven", "lamp");

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { instrument: "lamp", set: "current_a", values: [1] },
      });
    });

    it("keeps its settle when the new one is not a number", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.settleFor", "soon");

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("a sweep an instrument drives", () => {
    const sweep: ProcedureStep = {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
      read: [{ instrument: "dut", command: "hello", as: "reply" }],
    };

    it("takes only numbers as points, since an instrument cannot be set to a label", async () => {
      const { onChange, user } = renderSentence(sweep);

      await retype(user, "iot.calibration.procedure.values", "0.8, dim");
      expect(onChange).not.toHaveBeenCalled();

      await retype(user, "iot.calibration.procedure.values", "1, 2, 3");
      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { instrument: "lamp", set: "current_a", values: [1, 2, 3] },
      });
    });

    it("steps another setpoint of the same instrument", async () => {
      const { onChange, user } = renderSentence(sweep);

      await choose(user, "iot.calibration.procedure.setpoint", /voltage_v/);

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { instrument: "lamp", set: "voltage_v", values: [0.8, 2.4] },
      });
    });

    it("moves to another instrument on that instrument's first setpoint", async () => {
      const { onChange, user } = renderSentence(sweep);

      await choose(user, "iot.calibration.procedure.driven", "dut");

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: { instrument: "dut", set: "led_setting", values: [0.8, 2.4] },
      });
    });

    it("hands the sweep to the operator with its points kept", async () => {
      const { onChange, user } = renderSentence(sweep);

      await choose(
        user,
        "iot.calibration.procedure.driven",
        "iot.calibration.procedure.operatorSource",
      );

      expect(onChange).toHaveBeenLastCalledWith({
        ...sweep,
        stimulus: {
          operator: "iot.calibration.procedure.operatorStimulusPrompt",
          values: [0.8, 2.4],
        },
      });
    });
  });

  it("reads as plain text with nothing to click on a closed definition", () => {
    renderSentence(
      { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
      { canEdit: false },
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
