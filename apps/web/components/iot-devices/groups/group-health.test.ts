import { createDeviceGroupMemberHealth } from "@/test/factories";
import { describe, expect, it } from "vitest";

import {
  filterGroupMembers,
  isMemberSilent,
  summarizeGroupHealth,
} from "@repo/api/domains/iot/device-group/group-health";

const NOW = new Date("2026-08-18T12:00:00.000Z").getTime();
const RECENT = "2026-08-18T11:30:00.000Z";
const STALE = "2026-08-18T09:00:00.000Z";

const online = { connected: true, lastSeenAt: null };

describe("isMemberSilent", () => {
  it("flags a connected device with stale or missing data", () => {
    const stale = createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: STALE });
    const never = createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: null });

    expect(isMemberSilent(stale, false, NOW)).toBe(true);
    expect(isMemberSilent(never, false, NOW)).toBe(true);
  });

  it("does not flag fresh, offline, or unknown devices", () => {
    const fresh = createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT });
    const offline = createDeviceGroupMemberHealth({
      connectivity: { connected: false, lastSeenAt: null },
      lastDataAt: STALE,
    });
    const unknown = createDeviceGroupMemberHealth({ connectivity: null, lastDataAt: null });

    expect(isMemberSilent(fresh, false, NOW)).toBe(false);
    expect(isMemberSilent(offline, false, NOW)).toBe(false);
    expect(isMemberSilent(unknown, false, NOW)).toBe(false);
  });

  it("exempts phones: connecting only while the app is open is their normal", () => {
    const phone = createDeviceGroupMemberHealth({
      deviceType: "mobile",
      connectivity: online,
      lastDataAt: null,
    });

    expect(isMemberSilent(phone, false, NOW)).toBe(false);
  });

  it("never judges silence while the pipeline is unavailable", () => {
    const member = createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: null });

    expect(isMemberSilent(member, true, NOW)).toBe(false);
  });
});

describe("summarizeGroupHealth", () => {
  it("counts online, unknown, and silent members", () => {
    const members = [
      createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT }),
      createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: STALE }),
      createDeviceGroupMemberHealth({
        connectivity: { connected: false, lastSeenAt: null },
        lastDataAt: null,
      }),
      createDeviceGroupMemberHealth({ connectivity: null, lastDataAt: null }),
    ];

    expect(summarizeGroupHealth(members, false, NOW)).toEqual({
      total: 4,
      online: 2,
      unknown: 1,
      silent: 1,
    });
  });
});

describe("filterGroupMembers", () => {
  const label = (member: { name: string | null }) => member.name ?? "unnamed";
  const members = [
    createDeviceGroupMemberHealth({
      name: "Greenhouse Gateway",
      deviceType: "ambyte",
      serialNumber: "AA:11",
      connectivity: online,
      lastDataAt: RECENT,
    }),
    createDeviceGroupMemberHealth({
      name: "Field Node",
      deviceType: "multispeq",
      serialNumber: "BB:22",
      connectivity: online,
      lastDataAt: STALE,
    }),
    createDeviceGroupMemberHealth({
      name: "Cold Spare",
      deviceType: "ambyte",
      serialNumber: "CC:33",
      connectivity: { connected: false, lastSeenAt: null },
    }),
    createDeviceGroupMemberHealth({
      name: null,
      serialNumber: "DD:44",
      deviceType: "mobile",
      connectivity: null,
    }),
  ];

  it("searches names and serials case-insensitively", () => {
    const byName = filterGroupMembers(
      members,
      { search: "greenhouse", statuses: [], families: [] },
      false,
      NOW,
      label,
    );
    expect(byName.map(label)).toEqual(["Greenhouse Gateway"]);

    const bySerial = filterGroupMembers(
      members,
      { search: "dd:44", statuses: [], families: [] },
      false,
      NOW,
      label,
    );
    expect(bySerial.map(label)).toEqual(["unnamed"]);
  });

  it("filters by each health value", () => {
    const pick = (status: "all" | "online" | "offline" | "silent" | "unknown") =>
      filterGroupMembers(
        members,
        { search: "", statuses: status === "all" ? [] : [status], families: [] },
        false,
        NOW,
        label,
      ).map(label);

    expect(pick("all")).toHaveLength(4);
    expect(pick("online")).toEqual(["Greenhouse Gateway", "Field Node"]);
    expect(pick("offline")).toEqual(["Cold Spare"]);
    expect(pick("silent")).toEqual(["Field Node"]);
    expect(pick("unknown")).toEqual(["unnamed"]);
  });

  it("matches any selected health value without duplicating silent online members", () => {
    expect(
      filterGroupMembers(
        members,
        { search: "", statuses: ["offline", "unknown"], families: [] },
        false,
        NOW,
        label,
      ).map(label),
    ).toEqual(["Cold Spare", "unnamed"]);
    expect(
      filterGroupMembers(
        members,
        { search: "", statuses: ["online", "silent"], families: [] },
        false,
        NOW,
        label,
      ).map(label),
    ).toEqual(["Greenhouse Gateway", "Field Node"]);
    expect(
      filterGroupMembers(
        members,
        { search: "", statuses: ["silent"], families: [] },
        true,
        NOW,
        label,
      ),
    ).toEqual([]);
  });

  it("matches any selected family and leaves all families visible when none are selected", () => {
    expect(
      filterGroupMembers(
        members,
        { search: "", statuses: [], families: ["ambyte", "mobile"] },
        false,
        NOW,
        label,
      ).map(label),
    ).toEqual(["Greenhouse Gateway", "Cold Spare", "unnamed"]);
    expect(
      filterGroupMembers(members, { search: "", statuses: [], families: [] }, false, NOW, label),
    ).toEqual(members);
  });

  it("combines families with health and search", () => {
    expect(
      filterGroupMembers(
        members,
        { search: "gateway", statuses: ["online", "unknown"], families: ["ambyte", "mobile"] },
        false,
        NOW,
        label,
      ).map(label),
    ).toEqual(["Greenhouse Gateway"]);
    expect(
      filterGroupMembers(
        members,
        { search: "", statuses: ["silent"], families: ["ambyte"] },
        false,
        NOW,
        label,
      ),
    ).toEqual([]);
  });

  it("combines search and status", () => {
    const result = filterGroupMembers(
      members,
      { search: "node", statuses: ["silent"], families: [] },
      false,
      NOW,
      label,
    );
    expect(result.map(label)).toEqual(["Field Node"]);
  });
});
