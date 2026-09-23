import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import type { ReadSource } from "./rig-sources";
import { StepReadsClause } from "./step-reads-clause";

const SOURCES: ReadSource[] = [
  { role: "dut", offered: ["hello", "get_par"], isExhaustive: false },
  { role: "par_ref", offered: ["par", "par_raw"], isExhaustive: true },
];

const DEVICE_READ: ProcedureRead = { instrument: "dut", command: "get_par", as: "get_par" };
const REFERENCE_READ: ProcedureRead = { instrument: "par_ref", command: "par", as: "par_ref" };

function renderClause(
  reads: ProcedureRead[],
  props: Partial<Parameters<typeof StepReadsClause>[0]> = {},
) {
  const onChange = vi.fn<(reads: ProcedureRead[]) => void>();
  render(
    <StepReadsClause reads={reads} sources={SOURCES} canEdit onChange={onChange} {...props} />,
  );
  return { onChange, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

async function retype(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.click(screen.getByRole("button", { name: label }));
  const field = screen.getByRole("textbox", { name: label });
  await user.clear(field);
  await user.type(field, text);
  await user.tab();
}

async function chooseSource(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  option: string,
) {
  await user.click(
    screen.getAllByRole("combobox", { name: "iot.calibration.procedure.source" })[index],
  );
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("StepReadsClause", () => {
  // A column the reading named itself follows the reading, so it never goes stale.
  it("renames a column that was the device command's own when the command changes", async () => {
    const { onChange, user } = renderClause([DEVICE_READ]);

    await retype(user, "iot.calibration.procedure.command", "hello");

    expect(onChange).toHaveBeenLastCalledWith([
      { instrument: "dut", command: "hello", as: "hello" },
    ]);
  });

  it("keeps a column the author chose when the command changes", async () => {
    const { onChange, user } = renderClause([{ ...DEVICE_READ, as: "counts" }]);

    await retype(user, "iot.calibration.procedure.command", "hello");

    expect(onChange).toHaveBeenLastCalledWith([
      { instrument: "dut", command: "hello", as: "counts" },
    ]);
  });

  it("offers bench equipment's readings as a closed list", async () => {
    const { onChange, user } = renderClause([REFERENCE_READ]);

    await user.click(screen.getByRole("combobox", { name: "iot.calibration.procedure.reading" }));
    await user.click(await screen.findByRole("option", { name: "par_raw" }));

    expect(onChange).toHaveBeenLastCalledWith([
      { instrument: "par_ref", command: "par_raw", as: "par_ref" },
    ]);
  });

  it("hands a reading to the operator, who is asked for a number", async () => {
    const { onChange, user } = renderClause([DEVICE_READ]);

    await chooseSource(user, 0, "iot.calibration.procedure.operatorSource");

    expect(onChange).toHaveBeenLastCalledWith([
      {
        operator: "iot.calibration.procedure.operatorReadPrompt",
        as: "reference",
        type: "number",
      },
    ]);
  });

  it("moves a reading to another instrument on the first thing it answers", async () => {
    const { onChange, user } = renderClause([DEVICE_READ]);

    await chooseSource(user, 0, "par_ref");

    expect(onChange).toHaveBeenLastCalledWith([
      { instrument: "par_ref", command: "par", as: "par_ref" },
    ]);
  });

  it("rewrites what the operator is asked for", async () => {
    const operatorRead: ProcedureRead = {
      operator: "Type the reference",
      as: "reference",
      type: "number",
    };
    const { onChange, user } = renderClause([operatorRead]);

    await retype(user, "iot.calibration.procedure.operatorPrompt", "Type the meter");

    expect(onChange).toHaveBeenLastCalledWith([{ ...operatorRead, operator: "Type the meter" }]);
  });

  it("marks a column another reading in the step already records", () => {
    renderClause([DEVICE_READ, { ...REFERENCE_READ, as: "get_par" }]);

    for (const column of screen.getAllByRole("button", {
      name: "iot.calibration.procedure.column",
    })) {
      expect(column).toHaveClass("text-destructive");
    }
  });

  it("adds a reading of the first source under a column nothing else holds", async () => {
    const { onChange, user } = renderClause([{ ...DEVICE_READ, command: "hello", as: "hello" }]);

    await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.addRead" }));

    expect(onChange).toHaveBeenLastCalledWith([
      { instrument: "dut", command: "hello", as: "hello" },
      { instrument: "dut", command: "hello", as: "hello_2" },
    ]);
  });

  it("removes a reading while another is left to record", async () => {
    const { onChange, user } = renderClause([DEVICE_READ, REFERENCE_READ]);

    await user.click(
      screen.getAllByRole("button", { name: "iot.calibration.procedure.removeRead" })[0],
    );

    expect(onChange).toHaveBeenLastCalledWith([REFERENCE_READ]);
  });

  it("will not remove a step's last reading", () => {
    renderClause([DEVICE_READ]);

    expect(
      screen.queryByRole("button", { name: "iot.calibration.procedure.removeRead" }),
    ).toBeNull();
  });

  it("offers nothing to change on a closed definition", () => {
    renderClause([DEVICE_READ, REFERENCE_READ], { canEdit: false });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
