import { describe, expect, it } from "vitest";

import { compareFirmwareVersions, firmwareFloorIssue } from "./iot-calibration.schema";

describe("compareFirmwareVersions", () => {
  it("orders by major, minor, then patch", () => {
    expect(compareFirmwareVersions("1.1.3", "1.1.4")).toBeLessThan(0);
    expect(compareFirmwareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareFirmwareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("treats equal versions as equivalent", () => {
    expect(compareFirmwareVersions("1.1.3", "1.1.3")).toBe(0);
  });

  it("compares numerically, not as strings", () => {
    // The bug a lexicographic compare would have: "1.1.10" < "1.1.9".
    expect(compareFirmwareVersions("1.1.10", "1.1.9")).toBeGreaterThan(0);
  });

  // A release's prerelease suffix is not device-visible: the firmware reports
  // only the numeric core, so 1.1.3-rc1 satisfies a 1.1.3 requirement.
  it("ignores a prerelease suffix", () => {
    expect(compareFirmwareVersions("1.1.3-rc1", "1.1.3")).toBe(0);
  });

  it("returns null when a version cannot be parsed", () => {
    expect(compareFirmwareVersions("unknown", "1.1.3")).toBeNull();
    expect(compareFirmwareVersions("1.1.3", "")).toBeNull();
    expect(compareFirmwareVersions("1", "1.1.3")).toBeNull();
  });

  // MiniPAR reports two parts ("1.03"); a definition may still set a
  // three-part minimum, and the two must compare against each other.
  it("treats a missing patch as zero", () => {
    expect(compareFirmwareVersions("1.03", "1.03.0")).toBe(0);
    expect(compareFirmwareVersions("1.03", "1.03.1")).toBeLessThan(0);
    expect(compareFirmwareVersions("1.04", "1.03")).toBeGreaterThan(0);
    expect(compareFirmwareVersions("1.1", "1.03")).toBeLessThan(0);
  });
});

describe("firmwareFloorIssue", () => {
  it("raises nothing when the definition sets no floor", () => {
    expect(firmwareFloorIssue(null, undefined)).toBeNull();
    expect(firmwareFloorIssue(null, "0.9.0")).toBeNull();
  });

  // Fail closed: older firmware answers unknown commands with numbers that look like data.
  it("refuses a device that reported no version once a floor is set", () => {
    expect(firmwareFloorIssue("1.1.3", undefined)).toBe(
      "This calibration requires firmware 1.1.3; the device did not report a version",
    );
  });

  it("refuses firmware below the floor and names both versions", () => {
    expect(firmwareFloorIssue("1.1.3", "1.1.2")).toBe(
      "This calibration requires firmware 1.1.3; the device reports 1.1.2",
    );
  });

  it("accepts the floor itself and anything newer", () => {
    expect(firmwareFloorIssue("1.1.3", "1.1.3")).toBeNull();
    expect(firmwareFloorIssue("1.1.3", "1.2.0")).toBeNull();
    expect(firmwareFloorIssue("1.1.3", "1.1.3-rc1")).toBeNull();
  });

  it("says when the two versions cannot be compared", () => {
    expect(firmwareFloorIssue("1.1.3", "2026-02-11")).toBe(
      "Could not compare the device firmware 2026-02-11 against the required 1.1.3",
    );
  });
});
