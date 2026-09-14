import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationVerificationReadings } from "./calibration-verification-readings";

describe("CalibrationVerificationReadings", () => {
  it("tables each series with its columns, formatting each cell as it was read", () => {
    render(
      <CalibrationVerificationReadings
        verification={{
          par_check: [{ par: 398.123456789, par_ref: 398.5, stimulus: "no filter" }],
          spec_check: [{ spec: "AS7341,19,53", channels: [0.00785574, 0.00343847], dark: true }],
        }}
      />,
    );

    expect(screen.getByText("par_check")).toBeInTheDocument();
    expect(screen.getByText("spec_check")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "par",
      "par_ref",
      "stimulus",
      "spec",
      "channels",
      "dark",
    ]);
    expect(screen.getByText("398.123")).toBeInTheDocument();
    expect(screen.getByText("no filter")).toBeInTheDocument();
    expect(screen.getByText("AS7341,19,53")).toBeInTheDocument();
    expect(screen.getByText("0.00785574, 0.00343847")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
