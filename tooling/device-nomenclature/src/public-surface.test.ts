import { describe, expect, expectTypeOf, it } from "vitest";

import type { ConformanceChannel, HostFamilySupport, HostKey, HostSupportState } from "./index.js";
import { HOST_SUPPORT_CATALOG, SUPPORT_HOSTS } from "./index.js";

/**
 * Guards the package's public export surface. Tickets 3 and 4 import these from
 * the package root, so a dropped re-export (a type-level regression a value-only
 * unit test would not catch) fails this file's typecheck, and in turn the
 * declaration build that emits `dist/index.d.ts`.
 */
describe("public surface", () => {
  it("re-exports the runtime catalog values", () => {
    expect(Object.keys(HOST_SUPPORT_CATALOG).toSorted()).toEqual(["mobile", "web"]);
    expect([...SUPPORT_HOSTS]).toEqual(["web", "mobile"]);
  });

  it("re-exports ConformanceChannel as the precise union from the package root", () => {
    expectTypeOf<ConformanceChannel>().toEqualTypeOf<"bluetooth-classic" | "ble" | "usb-serial">();
    const channel: ConformanceChannel = "ble";
    expect(channel).toBe("ble");
  });

  it("re-exports the host support types from the package root", () => {
    expectTypeOf<HostKey>().toEqualTypeOf<"web" | "mobile">();
    expectTypeOf<HostSupportState>().toEqualTypeOf<
      "current-specific" | "current-generic-compatibility" | "unavailable"
    >();
    const sample: HostFamilySupport = HOST_SUPPORT_CATALOG.web.multispeq;
    expect(sample.state).toBe("current-specific");
    expectTypeOf(sample.transports).toEqualTypeOf<readonly ConformanceChannel[]>();
  });
});
