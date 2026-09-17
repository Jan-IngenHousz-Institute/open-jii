import { describe, expect, it } from "vitest";

import {
  ambitStoredCoefficients,
  parseAmbitBootDump,
  AMBIT_BOOT_DUMP_MAX_LINES,
} from "./device-info";

/**
 * A boot dump in the shapes the firmware prints. Values are plausible rather
 * than captured: no recorded device dump exists in this repository, so these
 * tests prove the format, not the bytes a unit emits.
 */
const DUMP = [
  "NEW AmbitV004 Ready",
  "ADPD Found, chip version: 192",
  "Metadata: lon:5.6634 lat:51.9851 alt:12 time:1787000000 acc:3 vacc:5 x:-12 y:4 z:1001",
  "Calibration: ADPD: 1021\t987\t1103\t954\t1200\t1015",
  "Calibration: Act_50:983 Act_100:2032 Act_150:3121 Act_200:4174 Act_250:5233",
  "Calibration: Name:AmbitV004 Actinic:0.2412 Spec:1.1893 Emit:0.9910 Sun:1.0 Temp_offset:-0.35 Temp_slope:1.002",
  "MLX: 16384 32768 4096",
  "FW: MAC:A0:B1:C2:D3:E4:F5\tSize:1245184\tDate:Mar  5 2026",
  "FW: 1.1.3",
].join("\n");

describe("parseAmbitBootDump", () => {
  it("reads the identity a hello reply cannot supply", () => {
    const info = parseAmbitBootDump(DUMP);

    expect(info.mac).toBe("A0:B1:C2:D3:E4:F5");
    expect(info.firmwareVersion).toBe("1.1.3");
    expect(info.name).toBe("AmbitV004");
    expect(info.isValid).toBe(true);
  });

  it("reads the stored coefficients a write-back must be able to restore", () => {
    const info = parseAmbitBootDump(DUMP);

    expect(info.lightSlope).toBeCloseTo(1.1893, 4);
    expect(info.actLedCoeff).toBeCloseTo(0.2412, 4);
    expect(info.emitCoeff).toBeCloseTo(0.991, 3);
    expect(info.tempOffset).toBeCloseTo(-0.35, 2);
    expect(info.tempSlope).toBeCloseTo(1.002, 3);
  });

  it("reads the six-channel ADPD baseline", () => {
    expect(parseAmbitBootDump(DUMP).adpdCalibration).toEqual([1021, 987, 1103, 954, 1200, 1015]);
  });

  it("reads the actinic curve as setting to count", () => {
    expect(parseAmbitBootDump(DUMP).actinicCurve).toEqual({
      50: 983,
      100: 2032,
      150: 3121,
      200: 4174,
      250: 5233,
    });
  });

  it("reads firmware build metadata, keeping a date that contains spaces", () => {
    const info = parseAmbitBootDump(DUMP);

    // The MAC line is tab-separated precisely because "Mar  5 2026" has spaces.
    expect(info.firmwareDate).toBe("Mar  5 2026");
    expect(info.firmwareSize).toBe(1245184);
  });

  it("coerces metadata numerically and keeps the firmware's own keys", () => {
    const info = parseAmbitBootDump(DUMP);

    expect(info.metadata.lat).toBeCloseTo(51.9851, 4);
    expect(info.metadata.alt).toBe(12);
    expect(info.metadata.z).toBe(1001);
  });

  // Field firmware prints what it has; a value it cannot express numerically
  // must not take the rest of the dump down with it.
  it("falls back on malformed values without failing the dump", () => {
    const info = parseAmbitBootDump(
      [
        "ADPD Found, chip version: ?",
        "Metadata: lon:n/a alt:12",
        "Calibration: Name:AmbitV004 Spec:abc",
        "FW: MAC:A0:B1:C2:D3:E4:F5\tSize:big",
        "FW: 1.1.3",
      ].join("\n"),
    );

    expect(info.adpdChipVersion).toBeNull();
    expect(info.metadata.lon).toBe("n/a");
    expect(info.metadata.alt).toBe(12);
    expect(info.lightSlope).toBe(0);
    expect(info.firmwareSize).toBe(0);
    expect(info.firmwareDate).toBe("");
    expect(info.isValid).toBe(true);
  });

  it("reads the MLX vector", () => {
    expect(parseAmbitBootDump(DUMP).mlxCalibration).toEqual([16384, 32768, 4096]);
  });

  describe("validity", () => {
    it("is invalid when the dump carried neither a version nor a calibration line", () => {
      const info = parseAmbitBootDump("NEW AmbitV004 Ready\nADPD Found, chip version: 192");

      expect(info.isValid).toBe(false);
      expect(info.mac).toBe("");
    });

    // A dump that reached the calibration line but was cut off before the
    // version still carries usable coefficients.
    it("is valid on the calibration line alone", () => {
      const info = parseAmbitBootDump("Calibration: Name:AmbitV004 Actinic:0.24 Spec:1.19");

      expect(info.isValid).toBe(true);
      expect(info.lightSlope).toBeCloseTo(1.19, 2);
    });

    it("does not mistake the MAC line for the version line", () => {
      const info = parseAmbitBootDump("FW: MAC:A0:B1\tSize:10\tDate:Mar  5 2026");

      expect(info.mac).toBe("A0:B1");
      expect(info.firmwareVersion).toBe("");
      expect(info.isValid).toBe(false);
    });
  });

  describe("read loop", () => {
    it("stops at the version line, ignoring later console traffic", () => {
      const info = parseAmbitBootDump(`${DUMP}\nCalibration: Name:Wrong Spec:9.9`);

      expect(info.name).toBe("AmbitV004");
      expect(info.lightSlope).toBeCloseTo(1.1893, 4);
    });

    it("stops after the firmware's line budget", () => {
      const padding = Array.from({ length: AMBIT_BOOT_DUMP_MAX_LINES }, () => "noise").join("\n");
      const info = parseAmbitBootDump(`${padding}\nFW: 1.1.3`);

      expect(info.firmwareVersion).toBe("");
    });

    it("tolerates carriage returns and blank lines", () => {
      const info = parseAmbitBootDump("\r\n\r\nCalibration: Spec:1.19\r\nFW: 1.1.3\r\n");

      expect(info.firmwareVersion).toBe("1.1.3");
      expect(info.lightSlope).toBeCloseTo(1.19, 2);
    });

    it("ignores lines it does not recognise", () => {
      const info = parseAmbitBootDump("rst:0x1 boot:0x13\nload:0x3fff0030\nFW: 1.1.3");

      expect(info.firmwareVersion).toBe("1.1.3");
      expect(info.isValid).toBe(true);
    });
  });
});

describe("ambitStoredCoefficients", () => {
  it("names the coefficients by the keys a definition writes back", () => {
    const coefficients = ambitStoredCoefficients(parseAmbitBootDump(DUMP));

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
});
