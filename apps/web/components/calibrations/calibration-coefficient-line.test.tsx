import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CoefficientSpec } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { CalibrationCoefficientLine } from "./calibration-coefficient-line";

function renderLine(
  spec: CoefficientSpec = { type: "number" },
  props: Partial<Parameters<typeof CalibrationCoefficientLine>[0]> = {},
) {
  const onChange = vi.fn();
  const onRename = vi.fn();
  const onRemove = vi.fn();
  const { container } = render(
    <CalibrationCoefficientLine
      name="slope"
      spec={spec}
      isWritable
      takenNames={["slope"]}
      canEdit
      onChange={onChange}
      onRename={onRename}
      onRemove={onRemove}
      {...props}
    />,
  );
  return {
    container,
    onChange,
    onRename,
    onRemove,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
}

describe("CalibrationCoefficientLine", () => {
  // The block names itself in its own header, so a line carries only what differs between
  // its siblings.
  it("carries its own name and leaves the block to its header", () => {
    renderLine();

    expect(
      screen.getByRole("button", { name: "iot.calibration.produces.coefficient" }),
    ).toHaveTextContent("slope");
    expect(screen.queryByRole("button", { name: "iot.calibration.produces.block" })).toBeNull();
  });

  // The rig already uses "…" as a range's own separator ("current_a 0…10 A"); an unset
  // bound has to read as something else, or the two facts become indistinguishable.
  it("marks an unset bound with a word, not the range glyph", () => {
    renderLine();

    expect(screen.getAllByText("iot.calibration.produces.noBound")).toHaveLength(2);
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("hides the bounds clause when reading a coefficient that has none", () => {
    const { container } = renderLine({ type: "number" }, { canEdit: false });

    expect(container.querySelector("li")).not.toHaveTextContent("iot.calibration.produces.between");
    expect(screen.queryByText("iot.calibration.produces.noBound")).not.toBeInTheDocument();
  });

  it("still reads a bound that was actually set on a closed definition", () => {
    const { container } = renderLine({ type: "number", min: 0.1, max: 10 }, { canEdit: false });

    expect(container.querySelector("li")).toHaveTextContent(
      "iot.calibration.produces.between 0.1 iot.calibration.produces.and 10",
    );
  });

  it("commits a bound once it parses as a number", async () => {
    const { onChange, user } = renderLine();

    await user.click(screen.getByRole("button", { name: "iot.calibration.produces.min" }));
    const min = screen.getByRole("textbox", { name: "iot.calibration.produces.min" });
    await user.type(min, "0.1");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ min: 0.1 }));
  });

  it("asks for the array's length once it is retyped as one", async () => {
    const { onChange, user } = renderLine();

    await user.click(screen.getByRole("combobox", { name: "iot.calibration.produces.type" }));
    await user.click(
      await screen.findByRole("option", { name: "iot.calibration.produces.typeName.number_array" }),
    );

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "number_array" }));
  });

  it("says a coefficient is only recorded when no writer covers it", () => {
    renderLine(undefined, { isWritable: false });

    expect(screen.getByText("iot.calibration.produces.recordedOnly")).toBeInTheDocument();
  });

  it("removes the coefficient", async () => {
    const { onRemove, user } = renderLine();

    await user.click(
      screen.getByRole("button", { name: "iot.calibration.produces.removeCoefficient" }),
    );

    expect(onRemove).toHaveBeenCalled();
  });

  it("offers nothing to change on a definition a run has closed", () => {
    renderLine(undefined, { canEdit: false });

    expect(
      screen.queryByRole("button", { name: "iot.calibration.produces.coefficient" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "iot.calibration.produces.removeCoefficient" }),
    ).toBeNull();
  });
});
