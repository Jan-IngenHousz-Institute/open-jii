import { describe, expect, it } from "vitest";

import {
  zAddIotDeviceGroupMembersBody,
  zCreateIotDeviceGroupBody,
  zIotDeviceGroupCredentialRow,
  zIotDeviceGroupCredentialsBody,
  zIotDeviceGroupMember,
  zUpdateIotDeviceGroupBody,
} from "./iot-device-group.schema";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

describe("zCreateIotDeviceGroupBody", () => {
  it("accepts a name alone", () => {
    expect(zCreateIotDeviceGroupBody.safeParse({ name: "Greenhouse A" }).success).toBe(true);
  });

  it("trims the name and rejects a blank one", () => {
    const parsed = zCreateIotDeviceGroupBody.safeParse({ name: "  Greenhouse A  " });
    expect(parsed.success && parsed.data.name).toBe("Greenhouse A");
    expect(zCreateIotDeviceGroupBody.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 255 chars", () => {
    expect(zCreateIotDeviceGroupBody.safeParse({ name: "x".repeat(256) }).success).toBe(false);
  });
});

describe("zUpdateIotDeviceGroupBody", () => {
  it("accepts a partial patch and a null description", () => {
    expect(zUpdateIotDeviceGroupBody.safeParse({}).success).toBe(true);
    expect(zUpdateIotDeviceGroupBody.safeParse({ description: null }).success).toBe(true);
  });
});

describe("zAddIotDeviceGroupMembersBody", () => {
  it("accepts a batch of device ids", () => {
    expect(
      zAddIotDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: [DEVICE_ID] })
        .success,
    ).toBe(true);
  });

  it("bounds the batch to 1..100 devices", () => {
    expect(
      zAddIotDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: [] }).success,
    ).toBe(false);
    const many = Array.from({ length: 101 }, () => DEVICE_ID);
    expect(
      zAddIotDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: many }).success,
    ).toBe(false);
  });

  it("rejects non-uuid device ids", () => {
    expect(
      zAddIotDeviceGroupMembersBody.safeParse({ groupId: GROUP_ID, deviceIds: ["gw-1"] }).success,
    ).toBe(false);
  });
});

describe("zIotDeviceGroupMember", () => {
  it("keeps the roster row shallow and display-only", () => {
    expect(
      zIotDeviceGroupMember.safeParse({
        deviceId: DEVICE_ID,
        name: null,
        serialNumber: "E8:F6:0A",
        deviceType: "ambyte",
        status: "active",
        connected: null,
        addedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});

describe("zIotDeviceGroupCredentialsBody", () => {
  it("accepts an omitted selection, meaning every member", () => {
    expect(zIotDeviceGroupCredentialsBody.safeParse({ groupId: GROUP_ID }).success).toBe(true);
  });

  it("caps an explicit selection at 100 and rejects an empty one", () => {
    expect(
      zIotDeviceGroupCredentialsBody.safeParse({ groupId: GROUP_ID, deviceIds: [] }).success,
    ).toBe(false);
    expect(
      zIotDeviceGroupCredentialsBody.safeParse({
        groupId: GROUP_ID,
        deviceIds: Array.from({ length: 101 }, () => DEVICE_ID),
      }).success,
    ).toBe(false);
  });
});

describe("zIotDeviceGroupCredentialRow", () => {
  it("carries either a one-time credential bundle or a row error", () => {
    expect(
      zIotDeviceGroupCredentialRow.safeParse({
        deviceId: DEVICE_ID,
        thingName: "ambyte_GW-1",
        credentials: {
          certificateId: "c1",
          certificateArn: "arn:c1",
          certificatePem: "PEM",
          publicKey: "PUB",
          privateKey: "KEY",
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      zIotDeviceGroupCredentialRow.safeParse({
        deviceId: DEVICE_ID,
        thingName: null,
        credentials: null,
        error: "Not a member of this group",
      }).success,
    ).toBe(true);
  });
});
