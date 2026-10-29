import { describe, expect, it } from "vitest";

import { resolveManagedClient } from "./manifest";

describe("managed client account configuration", () => {
  it("keeps the repository and callback fixed while resolving private account configuration", () => {
    const manifest = resolveManagedClient(
      "111111111111",
      "arn:aws:iam::222222222222:role/jii-instrument-tracking-prod-oidc-provisioner",
    );
    expect(manifest.sourceAccount).toBe("111111111111");
    expect(manifest.secretArnPrefix).toBe(
      "arn:aws:secretsmanager:eu-central-1:222222222222:secret:jii/instrument-tracking/prod/oidc-",
    );
    expect(manifest.redirectUris).toEqual([
      "https://assets.openjii.org/api/auth/oauth2/callback/openjii",
    ]);
  });

  it.each([
    [undefined, undefined],
    [
      "not-an-account",
      "arn:aws:iam::222222222222:role/jii-instrument-tracking-prod-oidc-provisioner",
    ],
    ["111111111111", "arn:aws:iam::222222222222:role/another-role"],
    [
      "111111111111",
      "arn:aws:iam::222222222222:role/jii-instrument-tracking-prod-oidc-provisioner/extra",
    ],
  ])("rejects missing or out-of-contract account configuration", (account, role) => {
    expect(() => resolveManagedClient(account, role)).toThrow(
      "Managed AWS account configuration is required",
    );
  });
});
