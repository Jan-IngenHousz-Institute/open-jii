import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationReadRow } from "./calibration-read-row";
import type { ReadSource } from "./rig-sources";

const SOURCES: ReadSource[] = [
  { role: "dut", offered: ["par_raw", "par"], isExhaustive: false },
  { role: "par_ref", offered: ["par", "temp"], isExhaustive: true },
];

function renderRow(props: Partial<Parameters<typeof CalibrationReadRow>[0]> = {}) {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  const read: ProcedureRead = { instrument: "dut", command: "par_raw", as: "par_raw" };
  render(
    <CalibrationReadRow
      read={read}
      sources={SOURCES}
      takenColumns={["par_raw"]}
      canEdit
      canRemove
      onChange={onChange}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onChange, onRemove };
}

describe("CalibrationReadRow", () => {
  it("shows the command a device is asked for as free text, since firmware knows more than the driver table", () => {
    renderRow();

    expect(screen.getByLabelText("iot.calibration.procedure.command")).toHaveValue("par_raw");
  });

  // Bench equipment answers a fixed set, so a typo there is avoidable rather than a bench failure.
  it("offers a bench instrument's readings as a closed list", () => {
    renderRow({ read: { instrument: "par_ref", command: "par", as: "par_ref" } });

    expect(screen.getByLabelText("iot.calibration.procedure.reading")).toBeInTheDocument();
    expect(screen.queryByLabelText("iot.calibration.procedure.command")).toBeNull();
  });

  it("renames the column the script indexes by", async () => {
    const { onChange } = renderRow();

    const column = screen.getByLabelText("iot.calibration.procedure.column");
    await userEvent.clear(column);
    await userEvent.type(column, "raw");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ as: "raw" }));
  });

  it("refuses a column another reading in the step already fills", async () => {
    const { onChange } = renderRow({ takenColumns: ["par_raw", "par_ref"] });

    const column = screen.getByLabelText("iot.calibration.procedure.column");
    await userEvent.clear(column);
    await userEvent.type(column, "par_ref");

    expect(screen.getByText("iot.calibration.procedure.columnTaken")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ as: "par_ref" }));
  });

  it("refuses a column that is not a payload key", async () => {
    const { onChange } = renderRow();

    const column = screen.getByLabelText("iot.calibration.procedure.column");
    await userEvent.clear(column);
    await userEvent.type(column, "1raw");

    expect(screen.getByText("iot.calibration.procedure.nameInvalid")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ as: "1raw" }));
  });

  // A column the reading named itself follows the reading, so changing the command does not
  // leave the old command's name on the new one.
  it("carries the command, and takes the generated column with it", async () => {
    const { onChange } = renderRow();

    await userEvent.type(screen.getByLabelText("iot.calibration.procedure.command"), "2");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: "par_raw2", as: "par_raw2" }),
    );
  });

  it("leaves a column the author named where it is", async () => {
    const { onChange } = renderRow({
      read: { instrument: "dut", command: "par_raw", as: "reference" },
      takenColumns: ["reference"],
    });

    await userEvent.type(screen.getByLabelText("iot.calibration.procedure.command"), "2");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ as: "reference" }));
  });

  // A reading handed to the operator is a different kind of thing, so the command it was
  // asking a device for cannot come along.
  it("turns an instrument reading into one the operator types in", async () => {
    const { onChange } = renderRow();

    await userEvent.click(screen.getByLabelText("iot.calibration.procedure.source"));
    await userEvent.click(
      await screen.findByRole("option", { name: "iot.calibration.procedure.operatorSource" }),
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operator: "iot.calibration.procedure.operatorReadPrompt",
        type: "number",
      }),
    );
  });

  it("opens a new instrument on the first reading it offers", async () => {
    const { onChange } = renderRow();

    await userEvent.click(screen.getByLabelText("iot.calibration.procedure.source"));
    await userEvent.click(await screen.findByRole("option", { name: "par_ref" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ instrument: "par_ref", command: "par" }),
    );
  });

  it("marks an operator reading with no prompt invalid", () => {
    renderRow({ read: { operator: "  ", as: "reference", type: "number" } });

    expect(screen.getByLabelText("iot.calibration.procedure.operatorPrompt")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("offers a typed answer only where a person is doing the reading", () => {
    const { unmount } = render(
      <CalibrationReadRow
        read={{ operator: "Read the meter", as: "reference", type: "number" }}
        sources={SOURCES}
        takenColumns={["reference"]}
        canEdit
        canRemove
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("iot.calibration.procedure.typed")).toBeInTheDocument();
    unmount();

    renderRow();
    expect(screen.queryByText("iot.calibration.procedure.typed")).toBeNull();
  });

  it("keeps the last reading of a step, which would otherwise produce nothing", () => {
    renderRow({ canRemove: false });

    expect(
      screen.getByRole("button", { name: "iot.calibration.procedure.removeRead" }),
    ).toBeDisabled();
  });
});
