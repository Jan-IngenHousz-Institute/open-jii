import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RETAKEN_SERIES_SUFFIX } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationSeriesField } from "./calibration-series-field";

function renderField(props: Partial<Parameters<typeof CalibrationSeriesField>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <CalibrationSeriesField
      series="par_sweep"
      taken={["par_sweep"]}
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, field: screen.getByLabelText("iot.calibration.procedure.series") };
}

describe("CalibrationSeriesField", () => {
  it("renames the series the script will index by", async () => {
    const { onChange, field } = renderField();

    await userEvent.clear(field);
    await userEvent.type(field, "dark");

    expect(onChange).toHaveBeenLastCalledWith("dark");
  });

  it("refuses a name another step in the phase already writes", async () => {
    const { onChange, field } = renderField({ taken: ["par_sweep", "dark"] });

    await userEvent.clear(field);
    await userEvent.type(field, "dark");

    expect(screen.getByText("iot.calibration.procedure.seriesTaken")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith("dark");
  });

  // Readings an operator took again live under this suffix; a series named the same way
  // would absorb another step's discarded attempts and feed them to the fit as real data.
  it("refuses the suffix that retaken readings are kept under", async () => {
    const { onChange, field } = renderField();

    await userEvent.clear(field);
    await userEvent.type(field, `dark${RETAKEN_SERIES_SUFFIX}`);

    expect(screen.getByText("iot.calibration.procedure.seriesReserved")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(`dark${RETAKEN_SERIES_SUFFIX}`);
  });

  it("refuses a name that is not a payload key", async () => {
    const { onChange, field } = renderField();

    await userEvent.clear(field);
    await userEvent.type(field, "1dark");

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("iot.calibration.procedure.nameInvalid")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith("1dark");
  });

  it("puts back the saved name when a rejected edit is abandoned", async () => {
    const { field } = renderField();

    await userEvent.clear(field);
    await userEvent.type(field, "1dark");
    await userEvent.tab();

    expect(field).toHaveValue("par_sweep");
  });
});
