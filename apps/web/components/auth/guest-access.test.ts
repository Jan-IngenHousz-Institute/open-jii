import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { guestGatedProcedures, guestMayUse } from "./guest-access";

const inventory = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../backend/src/authorization/core/models/guest-routes.json"),
    "utf8",
  ),
) as { procedure: string; classification: string }[];

const BETTER_AUTH_ROUTES = new Set(["organization.create"]);

describe("guestMayUse", () => {
  it.each(guestGatedProcedures.filter((procedure) => !BETTER_AUTH_ROUTES.has(procedure)))(
    "agrees with the backend's guest route inventory on %s",
    (procedure) => {
      const route = inventory.find((entry) => entry.procedure === procedure);
      expect(route, `${procedure} is not in guest-routes.json`).toBeDefined();
      expect(guestMayUse(procedure, true)).toBe(route?.classification !== "deny");
    },
  );

  it("never hides anything from a researcher", () => {
    for (const procedure of guestGatedProcedures) {
      expect(guestMayUse(procedure, false)).toBe(true);
    }
  });

  it("allows an action with no backend procedure behind it", () => {
    expect(guestMayUse(undefined, true)).toBe(true);
  });
});
