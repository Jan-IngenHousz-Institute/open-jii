import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationSetpointValues } from "./calibration-setpoint-values";

function renderValues(props: Partial<Parameters<typeof CalibrationSetpointValues>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <CalibrationSetpointValues
      values={[0, 1]}
      numbersOnly
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, field: screen.getByLabelText("iot.calibration.procedure.values") };
}

describe("CalibrationSetpointValues", () => {
  it("writes the points one per line", () => {
    const { field } = renderValues({ values: [0, 0.5, 1] });

    expect(field).toHaveValue("0\n0.5\n1");
  });

  it("commits a typed column of numbers", async () => {
    const { onChange, field } = renderValues({ values: [] });

    await userEvent.type(field, "1\n2");

    expect(onChange).toHaveBeenLastCalledWith([1, 2]);
  });

  // Committing a half-typed line would drop it silently when the document saves.
  it("holds the text back while a line is not yet a value", async () => {
    const { onChange, field } = renderValues({ values: [1] });

    await userEvent.clear(field);
    await userEvent.type(field, "1\n-");

    expect(field).toHaveValue("1\n-");
    expect(onChange).not.toHaveBeenCalledWith([1, expect.anything()]);
  });

  it("refuses more points than the contract accepts", async () => {
    const { onChange, field } = renderValues({ values: [] });

    await userEvent.clear(field);
    await userEvent.paste(Array.from({ length: 65 }, (_, i) => String(i)).join("\n"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes a label when the sweep is driven by hand rather than by an instrument", async () => {
    const { onChange, field } = renderValues({ values: [], numbersOnly: false });

    await userEvent.type(field, "ND filter 1");

    expect(onChange).toHaveBeenLastCalledWith(["ND filter 1"]);
  });

  // A bench that drives two things at once declares a point as an object, and one key of the
  // wrong shape makes the whole point meaningless rather than partly usable.
  it("takes a compound point as an object and drops keys that are not values", async () => {
    const { onChange, field } = renderValues({ values: [], numbersOnly: false });

    await userEvent.click(field);
    await userEvent.paste('{"current_a": 0.8, "filter": "ND1", "bad": [1]}');

    expect(onChange).toHaveBeenLastCalledWith([{ current_a: 0.8, filter: "ND1" }]);
  });

  it("holds a point that opens like an object but does not parse", async () => {
    const { onChange, field } = renderValues({ values: [], numbersOnly: false });

    await userEvent.click(field);
    await userEvent.paste('{"current_a": ');

    expect(field).toHaveValue('{"current_a": ');
    expect(onChange).not.toHaveBeenCalled();
  });

  it("locks the points on a definition a run has closed", () => {
    const { field } = renderValues({ canEdit: false });

    expect(field).toBeDisabled();
  });
});
