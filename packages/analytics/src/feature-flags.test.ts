import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS, flagPersonProperties } from "./feature-flags";

// Named so a failure says where to look: the flags PostHog holds are managed in OpenTofu.
const managedFlagsPath = "infrastructure/modules/posthog/flags.json";
const managedFlags: unknown = JSON.parse(
  readFileSync(join(resolve(__dirname, "../../.."), managedFlagsPath), "utf8"),
);

function keysOf(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${managedFlagsPath} is not an object of flags`);
  }
  return Object.keys(value);
}

describe("feature flags", () => {
  // A key the code checks but PostHog lacks is a flag that can never switch on.
  it(`checks exactly the flags ${managedFlagsPath} manages`, () => {
    expect(keysOf(managedFlags).sort()).toEqual(Object.values(FEATURE_FLAGS).sort());
  });
});

describe("flagPersonProperties", () => {
  it("joins the organization ids into one string a 'contains' condition can match", () => {
    expect(
      flagPersonProperties({ email: "ana@example.com", organizationIds: ["org-qa", "org-lab"] }),
    ).toEqual({ email: "ana@example.com", organization_ids: "org-qa,org-lab" });
  });

  it("leaves the email out when there is none to send", () => {
    expect(flagPersonProperties({ organizationIds: ["org-qa"] })).toEqual({
      organization_ids: "org-qa",
    });
  });
});
