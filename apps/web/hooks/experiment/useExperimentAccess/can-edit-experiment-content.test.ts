import { createExperimentAccess } from "@/test/factories";
import { describe, expect, it } from "vitest";

import { canEditExperimentContent } from "./can-edit-experiment-content";

describe("canEditExperimentContent", () => {
  it.each([
    { status: "active", isAdmin: true, allowed: true },
    { status: "stale", isAdmin: true, allowed: true },
    { status: "published", isAdmin: true, allowed: true },
    { status: "archived", isAdmin: true, allowed: false },
    { status: "active", isAdmin: false, allowed: false },
  ] as const)(
    "returns $allowed for $status with admin=$isAdmin",
    ({ status, isAdmin, allowed }) => {
      const access = createExperimentAccess({ experiment: { status }, isAdmin });
      expect(canEditExperimentContent(access)).toBe(allowed);
    },
  );

  it("returns false before access loads", () => {
    expect(canEditExperimentContent(undefined)).toBe(false);
  });
});
