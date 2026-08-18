import { createDeviceGroupMemberHealth } from "@/test/factories";
import { describe, expect, it } from "vitest";

import { isMemberSilent, summarizeGroupHealth } from "./group-health";

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
