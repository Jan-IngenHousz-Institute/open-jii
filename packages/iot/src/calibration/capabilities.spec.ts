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
    expect(minipar.writableCoefficients.par?.map((entry) => entry.name).sort()).toEqual([
      "intercept",
      "slope",
    ]);

    // A per-channel coefficient is submitted as an array, so a definition that declares it
    // as a number fails validation on its first real fit.
    expect(minipar.writableCoefficients.spec).toEqual([
      { name: "channel_coefficients", isArray: true },
    ]);
    expect(minipar.writableCoefficients.par?.every((entry) => !entry.isArray)).toBe(true);
  });

  // A read step names a console command, and a misremembered one only fails at the bench.
  it("offers the console commands the family's driver knows", () => {
    const minipar = familyCalibrationCapabilities("minipar");

    expect(minipar.commands).toContain("par_raw");
    expect(minipar.commands).toContain("hello");
    expect(minipar.commands).toEqual([...minipar.commands].sort());
    expect(new Set(minipar.commands).size).toBe(minipar.commands.length);
    expect(familyCalibrationCapabilities("ambit").commands).toContain("get_par");
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
