import { describe, expect, it } from "vitest";

import type { AmbitDeviceInfo } from "./device-info";
import {
  ambitStoredCoefficients,
  parseAmbitBootDump,
  AMBIT_BOOT_DUMP_MAX_LINES,
} from "./device-info";

/**
 * A boot dump in the shape the firmware prints it: every line tab-separated, the MAC as
 * twelve hex digits with no separators, fourteen MLX coefficients, and the free-text
 * `info1` among the metadata. Values are plausible rather than captured, but the widths
 * and separators are the firmware's, so a parser that only satisfies this fixture also
 * satisfies a device.
 */
const MLX_COEFFICIENTS = 14;

const DUMP = [
  "NEW AmbitV004 Ready",
  "ADPD Found, chip version: 192",
  "Metadata: lon:5.663400\tlat:51.985100\talt:12.000000\ttime:1787000000\tacc:3.000000" +
    "\tvacc:5.000000\tinfo1:field unit 4\tx:-12.000000\ty:4.000000\tz:1001.000000",
  "Calibration: ADPD: 1021\t987\t1103\t954\t1200\t1015",
  "Calibration: Act_50:983\tAct_100:2032\tAct_150:3121\tAct_200:4174\tAct_250:5233",
  "Calibration: Name:AmbitV004\tActinic:0.241200\tSpec:1.189300\tEmit:0.991000" +
    "\tSun:1.000000\tTemp_offset:-0.350000\tTemp_slope:1.002000",
  `MLX: ${Array.from({ length: MLX_COEFFICIENTS }, (_, i) => 100 + i).join("\t")}\t`,
  "FW: MAC:a0b1c2d3e4f5\tSize:1245184\tDate:Mar  5 2026",
  "FW: 1.1.3",
].join("\n");

function parsed(dump: string): AmbitDeviceInfo {
  const info = parseAmbitBootDump(dump);
  if (!info) {
    throw new Error("expected the dump to be recognised");
  }
  return info;
}

describe("parseAmbitBootDump", () => {
  it("reads the identity a hello reply cannot supply", () => {
    const info = parsed(DUMP);

    expect(info.mac).toBe("a0b1c2d3e4f5");
    expect(info.firmwareVersion).toBe("1.1.3");
    expect(info.name).toBe("AmbitV004");
  });

  it("reads the stored coefficients a write-back must be able to restore", () => {
    const info = parsed(DUMP);

    expect(info.lightSlope).toBeCloseTo(1.1893, 4);
    expect(info.actLedCoeff).toBeCloseTo(0.2412, 4);
    expect(info.emitCoeff).toBeCloseTo(0.991, 3);
    expect(info.tempOffset).toBeCloseTo(-0.35, 2);
    expect(info.tempSlope).toBeCloseTo(1.002, 3);
  });

  it("reads the six-channel ADPD baseline", () => {
    expect(parsed(DUMP).adpdCalibration).toEqual([1021, 987, 1103, 954, 1200, 1015]);
  });

  it("reads the actinic curve as setting to count", () => {
    expect(parsed(DUMP).actinicCurve).toEqual({
      50: 983,
      100: 2032,
      150: 3121,
      200: 4174,
      250: 5233,
    });
  });

  it("reads firmware build metadata, keeping a date that contains spaces", () => {
    const info = parsed(DUMP);

    // The MAC line is tab-separated precisely because "Mar  5 2026" has spaces.
    expect(info.firmwareDate).toBe("Mar  5 2026");
    expect(info.firmwareSize).toBe(1245184);
  });

  it("coerces metadata numerically and keeps the firmware's own keys", () => {
    const metadata = parsed(DUMP).metadata ?? {};

    expect(metadata.lat).toBeCloseTo(51.9851, 4);
    expect(metadata.alt).toBe(12);
    expect(metadata.z).toBe(1001);
    // Tab-separated in the firmware because `info1` is free text an operator types.
    expect(metadata.info1).toBe("field unit 4");
  });

  it("reads the MLX vector, all fourteen coefficients", () => {
    expect(parsed(DUMP).mlxCalibration).toHaveLength(MLX_COEFFICIENTS);
    expect(parsed(DUMP).mlxCalibration?.[0]).toBe(100);
  });
});

/**
 * The dump is read on a timeout, so the parser's job is to say what the device
 * reported and stay silent about the rest. A value it invents is worse than one it
 * omits: the write-back readback compares against these.
 */
describe("what the dump did not say", () => {
  // Field firmware prints what it has; a value it cannot express numerically
  // must not take the rest of the dump down with it.
  it("omits a malformed value without failing the dump", () => {
    const info = parsed(
      [
        "ADPD Found, chip version: ?",
        "Metadata: lon:n/a\talt:12",
        "Calibration: Name:AmbitV004 Spec:abc",
        "FW: MAC:A0:B1:C2:D3:E4:F5\tSize:big",
        "FW: 1.1.3",
      ].join("\n"),
    );

    expect(info.adpdChipVersion).toBeUndefined();
    expect(info.lightSlope).toBeUndefined();
    expect(info.firmwareSize).toBeUndefined();
    expect(info.firmwareDate).toBeUndefined();

    expect(info.metadata?.lon).toBe("n/a");
    expect(info.metadata?.alt).toBe(12);
    expect(info.name).toBe("AmbitV004");
    expect(info.firmwareVersion).toBe("1.1.3");
  });

  // A dump cut off before the calibration line holds no coefficients. Reporting zero
  // would let a readback verify a written coefficient against a number nobody read.
  it("omits every coefficient when the calibration line never arrived", () => {
    const info = parsed("NEW AmbitV004 Ready\nADPD Found, chip version: 192");

    expect(info.adpdChipVersion).toBe(192);
    expect(info.lightSlope).toBeUndefined();
    expect(info.mac).toBeUndefined();
    expect(ambitStoredCoefficients(info)).toEqual({});
  });

  // A dump that reached the calibration line but was cut off before the version
  // still carries usable coefficients.
  it("reports the coefficients on the calibration line alone", () => {
    const info = parsed("Calibration: Name:AmbitV004 Actinic:0.24 Spec:1.19");

    expect(info.lightSlope).toBeCloseTo(1.19, 2);
    expect(info.firmwareVersion).toBeUndefined();
  });

  it("does not mistake the MAC line for the version line", () => {
    const info = parsed("FW: MAC:A0:B1\tSize:10\tDate:Mar  5 2026");

    expect(info.mac).toBe("A0:B1");
    expect(info.firmwareVersion).toBeUndefined();
  });

  it("is null when no line was a boot dump at all", () => {
    expect(parseAmbitBootDump("rst:0x1 boot:0x13\nload:0x3fff0030")).toBeNull();
    expect(parseAmbitBootDump("")).toBeNull();
  });
});

describe("read loop", () => {
  it("stops at the version line, ignoring later console traffic", () => {
    const info = parsed(`${DUMP}\nCalibration: Name:Wrong Spec:9.9`);

    expect(info.name).toBe("AmbitV004");
    expect(info.lightSlope).toBeCloseTo(1.1893, 4);
  });

  it("stops after the firmware's line budget", () => {
    const padding = Array.from({ length: AMBIT_BOOT_DUMP_MAX_LINES }, () => "noise").join("\n");

    expect(parseAmbitBootDump(`${padding}\nFW: 1.1.3`)).toBeNull();
  });

  it("tolerates carriage returns and blank lines", () => {
    const info = parsed("\r\n\r\nCalibration: Spec:1.19\r\nFW: 1.1.3\r\n");

    expect(info.firmwareVersion).toBe("1.1.3");
    expect(info.lightSlope).toBeCloseTo(1.19, 2);
  });

  it("ignores lines it does not recognise", () => {
    const info = parsed("rst:0x1 boot:0x13\nload:0x3fff0030\nFW: 1.1.3");

    expect(info.firmwareVersion).toBe("1.1.3");
  });

  // The firmware prints the curve over several lines, so its points accumulate where
  // every other field is replaced by the last line that reported it.
  it("accumulates the actinic curve across lines", () => {
    const info = parsed(
      ["Calibration: Act_50:983 Act_100:2032", "Calibration: Act_150:3121", "FW: 1.1.3"].join("\n"),
    );

    expect(info.actinicCurve).toEqual({ 50: 983, 100: 2032, 150: 3121 });
  });
});

describe("ambitStoredCoefficients", () => {
  it("names the coefficients by the keys a definition writes back", () => {
    const coefficients = ambitStoredCoefficients(parsed(DUMP));

    // The keys are the write-back contract: a definition's `par.spec` block
    // maps to `set_spec`, `led.act` to `set_act`.
    expect(Object.keys(coefficients).sort()).toEqual([
      "act",
      "emit",
      "spec",
      "sun",
      "temp_offset",
      "temp_slope",
    ]);
    expect(coefficients.spec).toBeCloseTo(1.1893, 4);
    expect(coefficients.act).toBeCloseTo(0.2412, 4);
    expect(coefficients.emit).toBeCloseTo(0.991, 3);
    expect(coefficients.sun).toBe(1);
    expect(coefficients.temp_offset).toBeCloseTo(-0.35, 2);
    expect(coefficients.temp_slope).toBeCloseTo(1.002, 3);
  });

  it("leaves out a coefficient the dump never reported", () => {
    const coefficients = ambitStoredCoefficients(parsed("Calibration: Spec:1.19\nFW: 1.1.3"));

    expect(coefficients).toEqual({ spec: 1.19 });
  });
});
