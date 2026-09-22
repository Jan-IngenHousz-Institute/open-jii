import { describe, expect, it } from "vitest";

import { unitOnPort } from "./bench-session-unit";

const AMBIT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ambit 93:B0",
  serialNumber: "A4:CF:12:AA:93:B0",
  deviceType: "ambit",
};

describe("unitOnPort", () => {
  it("waits while nothing has answered", () => {
    expect(unitOnPort(undefined, "ambit", [AMBIT])).toEqual({ kind: "waiting" });
  });

  // A MAC is printed with separators or without, and in either case; the fleet holds one
  // spelling and the console reports another.
  it("finds the device however the identifier is punctuated", () => {
    const found = unitOnPort("a4cf12aa93b0", "ambit", [AMBIT]);

    expect(found).toMatchObject({ kind: "registered", device: { id: AMBIT.id } });
  });

  // The sensor on the bench is often not the thing the platform has a row for.
  it("says so when the fleet holds no such unit", () => {
    expect(unitOnPort("ff:ff:ff:ff:ff:ff", "ambit", [AMBIT])).toEqual({
      kind: "unregistered",
      serial: "ff:ff:ff:ff:ff:ff",
    });
  });

  // Two families could print the same identifier, and a procedure only runs against the
  // family it was written for.
  it("will not take a matching serial from another family", () => {
    expect(unitOnPort("a4cf12aa93b0", "minipar", [AMBIT])).toMatchObject({ kind: "unregistered" });
  });

  it("copes with a fleet that has not loaded yet", () => {
    expect(unitOnPort("a4cf12aa93b0", "ambit", undefined)).toMatchObject({ kind: "unregistered" });
  });
});
