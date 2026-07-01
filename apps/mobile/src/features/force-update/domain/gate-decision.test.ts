import { describe, expect, it } from "vitest";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { isUpdateRequired } from "./gate-decision";

const NOW = new Date("2026-06-12T12:00:00Z");

const gate = (overrides: Partial<PageForceUpdateFieldsFragment> = {}) =>
  ({
    active: true,
    minVersion: "2.0.0",
    effectiveAt: null,
    ...overrides,
  }) as PageForceUpdateFieldsFragment;

describe("isUpdateRequired", () => {
  it.each([
    ["null gate", null, "1.0.0", false],
    ["inactive gate", gate({ active: false }), "1.0.0", false],
    ["running below minVersion", gate(), "1.9.9", true],
    ["running at minVersion", gate(), "2.0.0", false],
    ["running above minVersion", gate(), "2.1.0", false],
    ["no minVersion set", gate({ minVersion: null }), "0.0.1", false],
    ["effectiveAt in the past", gate({ effectiveAt: "2026-01-01T00:00:00Z" }), "1.0.0", true],
    ["effectiveAt in the future", gate({ effectiveAt: "2027-01-01T00:00:00Z" }), "1.0.0", false],
    ["unparseable running version", gate(), "not-a-version", false],
  ] as const)("%s", (_name, g, running, expected) => {
    expect(isUpdateRequired(g, running, NOW)).toBe(expected);
  });
});
