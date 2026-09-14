import { describe, expect, it } from "vitest";

import {
  zExperimentDeviceEntry,
  zExperimentDeviceSeriesQuery,
  zExperimentDevicePathParam,
  zExperimentDevicesOverview,
} from "./experiment-devices.schema";

const validEntry = {
  device: {
    id: "11111111-1111-4111-8111-111111111111",
    thingName: "ambyte_AA11",
    serialNumber: "AA:11",
    name: "Bench sensor",
    deviceType: "ambyte",
    status: "active",
  },
  clientId: "ambyte_AA11",
  binding: {
    addedBy: "22222222-2222-4222-8222-222222222222",
    addedAt: "2026-01-01T00:00:00.000Z",
  },
  connectivity: { connected: true, lastSeenAt: null },
  lastDataAt: "2026-01-02T00:00:00.000Z",
  recentData: { measurementCount: 12, lastDataAt: "2026-01-02T00:00:00.000Z" },
  reported: {
    deviceName: "shed-logger",
    firmware: "ambyte-2",
    version: "2.4.1",
    battery: 4.18,
    totalMeasurements: 42,
    lastReportedAt: "2026-01-02T00:00:00.000Z",
  },
  canView: true,
};

describe("zExperimentDeviceEntry", () => {
  it("accepts a bound device with a nullable name", () => {
    expect(zExperimentDeviceEntry.safeParse(validEntry).success).toBe(true);
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        device: { ...validEntry.device, name: null },
      }).success,
    ).toBe(true);
  });

  it("accepts an unregistered publisher with no device, binding or facts", () => {
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        device: null,
        binding: null,
        connectivity: null,
        lastDataAt: null,
        recentData: null,
        reported: null,
        canView: false,
      }).success,
    ).toBe(true);
  });

  it("rejects reported facts with a negative total", () => {
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        reported: { ...validEntry.reported, totalMeasurements: -1 },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown device type or status", () => {
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        device: { ...validEntry.device, deviceType: "toaster" },
      }).success,
    ).toBe(false);
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        device: { ...validEntry.device, status: "on-fire" },
      }).success,
    ).toBe(false);
  });

  it("rejects a non-datetime addedAt and a negative count", () => {
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        binding: { ...validEntry.binding, addedAt: "yesterday" },
      }).success,
    ).toBe(false);
    expect(
      zExperimentDeviceEntry.safeParse({
        ...validEntry,
        recentData: { measurementCount: -1, lastDataAt: null },
      }).success,
    ).toBe(false);
  });
});

describe("zExperimentDevicesOverview", () => {
  it("accepts an empty roster with a window", () => {
    expect(
      zExperimentDevicesOverview.safeParse({
        devices: [],
        window: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z" },
        pipelineUnavailable: false,
      }).success,
    ).toBe(true);
  });
});

describe("zExperimentDevicePathParam", () => {
  it("requires both ids to be uuids", () => {
    expect(
      zExperimentDevicePathParam.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        deviceId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(
      zExperimentDevicePathParam.safeParse({ id: "not-a-uuid", deviceId: "also-not" }).success,
    ).toBe(false);
  });
});

describe("zExperimentDeviceSeriesQuery", () => {
  const valid = {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: "AMBYTE_28:37:2F:FF:E7:04",
    from: "2026-08-04T12:00:00.000Z",
    to: "2026-09-03T12:00:00.000Z",
    bucket: "day",
  };

  it("accepts a client id that is not a uuid, since publishers need not be registered", () => {
    expect(zExperimentDeviceSeriesQuery.safeParse(valid).success).toBe(true);
    expect(
      zExperimentDeviceSeriesQuery.safeParse({ ...valid, clientId: "cognito-abc" }).success,
    ).toBe(true);
  });

  it("rejects an inverted range and one longer than 31 days", () => {
    expect(
      zExperimentDeviceSeriesQuery.safeParse({ ...valid, from: valid.to, to: valid.from }).success,
    ).toBe(false);
    expect(
      zExperimentDeviceSeriesQuery.safeParse({ ...valid, from: "2026-01-01T00:00:00.000Z" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty client id and an unknown bucket", () => {
    expect(zExperimentDeviceSeriesQuery.safeParse({ ...valid, clientId: "" }).success).toBe(false);
    expect(zExperimentDeviceSeriesQuery.safeParse({ ...valid, bucket: "week" }).success).toBe(
      false,
    );
  });
});
