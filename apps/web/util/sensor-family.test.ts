import { describe, it, expect } from "vitest";

import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";

import {
  SENSOR_FAMILY_OPTIONS,
  getSensorFamilyBadgeColor,
  getSensorFamilyLabel,
} from "./sensor-family";
import type { SensorFamilyOption } from "./sensor-family";

describe("SENSOR_FAMILY_OPTIONS", () => {
  it("should contain one option per zSensorFamily value", () => {
    expect(SENSOR_FAMILY_OPTIONS).toHaveLength(zSensorFamily.options.length);
  });

  it("should include every value from zSensorFamily", () => {
    const values = SENSOR_FAMILY_OPTIONS.map((o) => o.value);
    for (const family of zSensorFamily.options) {
      expect(values).toContain(family);
    }
  });

  it("should preserve the order defined in zSensorFamily", () => {
    const values = SENSOR_FAMILY_OPTIONS.map((o) => o.value);
    expect(values).toEqual(zSensorFamily.options);
  });

  it("should have a non-empty label for every option", () => {
    for (const opt of SENSOR_FAMILY_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it("should mark ambyte as disabled", () => {
    const ambyte = SENSOR_FAMILY_OPTIONS.find((o) => o.value === "ambyte");
    expect(ambyte).toBeDefined();
    expect(ambyte?.disabled).toBe(true);
  });

  it("should mark minipar as disabled", () => {
    const minipar = SENSOR_FAMILY_OPTIONS.find((o) => o.value === "minipar");
    expect(minipar).toBeDefined();
    expect(minipar?.disabled).toBe(true);
  });

  it("should mark generic as enabled", () => {
    const generic = SENSOR_FAMILY_OPTIONS.find((o) => o.value === "generic");
    expect(generic).toBeDefined();
    expect(generic?.disabled).toBe(false);
  });

  it("should mark multispeq as enabled", () => {
    const multispeq = SENSOR_FAMILY_OPTIONS.find((o) => o.value === "multispeq");
    expect(multispeq).toBeDefined();
    expect(multispeq?.disabled).toBe(false);
  });

  it("should have the correct labels", () => {
    const byValue = Object.fromEntries(SENSOR_FAMILY_OPTIONS.map((o) => [o.value, o])) as Record<
      string,
      SensorFamilyOption
    >;

    expect(byValue.generic.label).toBe("Generic");
    expect(byValue.multispeq.label).toBe("MultispeQ");
    expect(byValue.ambyte.label).toBe("Ambyte");
    expect(byValue.minipar.label).toBe("MiniPAR");
  });
});

describe("getSensorFamilyLabel", () => {
  it("should return 'Generic' for generic", () => {
    expect(getSensorFamilyLabel("generic")).toBe("Generic");
  });

  it("should return 'MultispeQ' for multispeq", () => {
    expect(getSensorFamilyLabel("multispeq")).toBe("MultispeQ");
  });

  it("should return 'Ambyte' for ambyte", () => {
    expect(getSensorFamilyLabel("ambyte")).toBe("Ambyte");
  });

  it("should return 'MiniPAR' for minipar", () => {
    expect(getSensorFamilyLabel("minipar")).toBe("MiniPAR");
  });
});

describe("getSensorFamilyBadgeColor", () => {
  it("should return the published badge for multispeq", () => {
    expect(getSensorFamilyBadgeColor("multispeq")).toBe("bg-badge-published");
  });

  it("should return the active badge for ambyte", () => {
    expect(getSensorFamilyBadgeColor("ambyte")).toBe("bg-badge-active");
  });

  it("should fall back to the archived badge for any other family", () => {
    expect(getSensorFamilyBadgeColor("generic")).toBe("bg-badge-archived");
    expect(getSensorFamilyBadgeColor("minipar")).toBe("bg-badge-archived");
  });
});
