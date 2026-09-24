import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { CalibrationFlagProvider } from "./calibration-flag-context";
import { CalibrationGate } from "./calibration-gate";

describe("CalibrationGate", () => {
  it("shows the calibration surface to someone the flag is on for", () => {
    vi.mocked(notFound).mockClear();

    render(
      <CalibrationFlagProvider isEnabled>
        <CalibrationGate>
          <p>library</p>
        </CalibrationGate>
      </CalibrationFlagProvider>,
    );

    expect(screen.getByText("library")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  // Not found rather than forbidden: for everyone else, the page does not exist.
  it("is not found for everyone else", () => {
    vi.mocked(notFound).mockClear();

    render(
      <CalibrationGate>
        <p>library</p>
      </CalibrationGate>,
    );

    expect(notFound).toHaveBeenCalled();
  });
});
