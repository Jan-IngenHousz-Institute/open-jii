import { describe, expect, it } from "vitest";

import {
  zAddDeviceGroupMembersBody,
  zCreateDeviceGroupBody,
  zDeviceGroupMember,
  zUpdateDeviceGroupBody,
} from "./device-group.schema";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("zCreateDeviceGroupBody", () => {
  it("accepts a name alone", () => {
    expect(zCreateDeviceGroupBody.safeParse({ name: "Greenhouse A" }).success).toBe(true);
  });

  it("trims the name and rejects a blank one", () => {
    const parsed = zCreateDeviceGroupBody.safeParse({ name: "  Greenhouse A  " });
    expect(parsed.success && parsed.data.name).toBe("Greenhouse A");
    expect(zCreateDeviceGroupBody.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 255 chars", () => {
    expect(zCreateDeviceGroupBody.safeParse({ name: "x".repeat(256) }).success).toBe(false);
  });
});

describe("zUpdateDeviceGroupBody", () => {
  it("accepts a partial patch and a null description", () => {
    expect(zUpdateDeviceGroupBody.safeParse({}).success).toBe(true);
    expect(zUpdateDeviceGroupBody.safeParse({ description: null }).success).toBe(true);
  });
});

describe("zAddDeviceGroupMembersBody", () => {
  it("accepts a batch of device ids", () => {
    expect(
      zAddDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: [DEVICE_ID] }).success,
    ).toBe(true);
  });

  it("bounds the batch to 1..100 devices", () => {
    expect(zAddDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: [] }).success).toBe(
      false,
    );
    const many = Array.from({ length: 101 }, () => DEVICE_ID);
    expect(
      zAddDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: many }).success,
    ).toBe(false);
  });

  it("rejects non-uuid device ids", () => {
    expect(
      zAddDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: ["gw-1"] }).success,
    ).toBe(false);
  });
});

describe("zDeviceGroupMember", () => {
  it("keeps the roster row shallow and display-only", () => {
    expect(
      zDeviceGroupMember.safeParse({
        deviceId: DEVICE_ID,
        name: null,
        serialNumber: "E8:F6:0A",
        deviceType: "ambyte",
        status: "active",
        addedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});
