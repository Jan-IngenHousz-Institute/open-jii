import { describe, expect, it } from "vitest";

import { benchInstrumentSummaries, familyCalibrationCapabilities } from "./capabilities";

describe("benchInstrumentSummaries", () => {
  // An author names bench equipment by the token it answers, and a wrong one is only
  // discovered when Connect refuses the port at the bench.
  it("names every instrument by the handshake a procedure must declare", () => {
    const tokens = benchInstrumentSummaries().map((instrument) => instrument.identityToken);

    expect(tokens).toContain("KIPRIM");
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("carries the setpoints and readings an instrument actually has", () => {
    const supply = benchInstrumentSummaries().find(
      (instrument) => instrument.identityToken === "KIPRIM",
    );

    expect(supply?.setpoints.map((setpoint) => setpoint.name)).toContain("current_a");
    expect(supply?.readings).toEqual([]);
  });
});

describe("familyCalibrationCapabilities", () => {
  // The coupling that fails silently: a block no writer covers is approved and never
  // reaches the device.
  it("names the blocks and coefficients a family can be written with", () => {
    const minipar = familyCalibrationCapabilities("minipar");

    expect(Object.keys(minipar.writableCoefficients).sort()).toEqual(["par", "spec"]);
    expect(minipar.writableCoefficients.par.sort()).toEqual(["intercept", "slope"]);
  });

  it("carries the setpoints the device under test can be driven through", () => {
    const ambit = familyCalibrationCapabilities("ambit");

    expect(ambit.deviceSetpoints.map((setpoint) => setpoint.name)).toEqual(["led_setting"]);
    expect(ambit.deviceSetpoints[0].integer).toBe(true);
  });

  // A family the platform cannot write is a real case, and a definition for it is still
  // worth authoring: the run is recorded even though nothing is sent.
  it("reports a family with no writers as writable nowhere, rather than failing", () => {
    const multispeq = familyCalibrationCapabilities("multispeq");

    expect(multispeq.writableCoefficients).toEqual({});
    expect(multispeq.deviceSetpoints.length).toBeGreaterThan(0);
  });
});
