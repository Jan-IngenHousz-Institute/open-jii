import { describe, expect, it } from "vitest";

import { canRemoveSignInMethod, hasUsableEmail } from "./sign-in-methods";
import type { SignInMethods } from "./sign-in-methods";

const EMAIL = "researcher@example.com";
const ORCID_ID = "0000-0002-1825-0097";

function methods(overrides: Partial<SignInMethods>): SignInMethods {
  return { email: EMAIL, emailVerified: true, passkeyCount: 0, accountIds: [], ...overrides };
}

describe("hasUsableEmail", () => {
  it("accepts a verified address", () => {
    expect(hasUsableEmail(EMAIL, true)).toBe(true);
  });

  it("rejects an unverified address", () => {
    expect(hasUsableEmail(EMAIL, false)).toBe(false);
  });

  it("rejects the ORCID placeholder even when marked verified", () => {
    expect(hasUsableEmail(ORCID_ID, true)).toBe(false);
  });
});

describe("canRemoveSignInMethod", () => {
  it("allows disconnecting GitHub from a verified email account", () => {
    const github = methods({ accountIds: ["github-row"] });

    expect(canRemoveSignInMethod(github, { kind: "account", accountId: "github-row" })).toBe(true);
  });

  it("allows deleting the only passkey of a verified email account", () => {
    const passkey = methods({ passkeyCount: 1 });

    expect(canRemoveSignInMethod(passkey, { kind: "passkey" })).toBe(true);
  });

  it("refuses disconnecting ORCID from a placeholder account with nothing else", () => {
    const orcidOnly = methods({ email: ORCID_ID, emailVerified: false, accountIds: ["orcid-row"] });

    expect(canRemoveSignInMethod(orcidOnly, { kind: "account", accountId: "orcid-row" })).toBe(
      false,
    );
  });

  it("allows disconnecting either provider from a placeholder account with both", () => {
    const both = methods({
      email: ORCID_ID,
      emailVerified: false,
      accountIds: ["orcid-row", "github-row"],
    });

    expect(canRemoveSignInMethod(both, { kind: "account", accountId: "github-row" })).toBe(true);
    expect(canRemoveSignInMethod(both, { kind: "account", accountId: "orcid-row" })).toBe(true);
  });

  it("allows disconnecting ORCID from a placeholder account with one passkey", () => {
    const orcidAndPasskey = methods({
      email: ORCID_ID,
      emailVerified: false,
      passkeyCount: 1,
      accountIds: ["orcid-row"],
    });

    expect(
      canRemoveSignInMethod(orcidAndPasskey, { kind: "account", accountId: "orcid-row" }),
    ).toBe(true);
  });

  it("allows deleting the last passkey of a placeholder account while ORCID is connected", () => {
    const orcidAndPasskey = methods({
      email: ORCID_ID,
      emailVerified: false,
      passkeyCount: 1,
      accountIds: ["orcid-row"],
    });

    expect(canRemoveSignInMethod(orcidAndPasskey, { kind: "passkey" })).toBe(true);
  });

  it("refuses deleting the last passkey of a placeholder account once ORCID is gone", () => {
    const passkeyOnly = methods({ email: ORCID_ID, emailVerified: false, passkeyCount: 1 });

    expect(canRemoveSignInMethod(passkeyOnly, { kind: "passkey" })).toBe(false);
  });

  it("allows deleting one of two passkeys from a placeholder account", () => {
    const twoPasskeys = methods({ email: ORCID_ID, emailVerified: false, passkeyCount: 2 });

    expect(canRemoveSignInMethod(twoPasskeys, { kind: "passkey" })).toBe(true);
  });

  it("refuses disconnecting the only provider when the real address is unverified", () => {
    const unverified = methods({ emailVerified: false, accountIds: ["github-row"] });

    expect(canRemoveSignInMethod(unverified, { kind: "account", accountId: "github-row" })).toBe(
      false,
    );
  });

  it("refuses disconnecting the only provider when the placeholder is marked verified", () => {
    const verifiedPlaceholder = methods({ email: ORCID_ID, accountIds: ["orcid-row"] });

    expect(
      canRemoveSignInMethod(verifiedPlaceholder, { kind: "account", accountId: "orcid-row" }),
    ).toBe(false);
  });

  it("treats an account id the person does not hold as removing nothing", () => {
    const orcidOnly = methods({ email: ORCID_ID, emailVerified: false, accountIds: ["orcid-row"] });
    const nothing = methods({ email: ORCID_ID, emailVerified: false });

    expect(canRemoveSignInMethod(orcidOnly, { kind: "account", accountId: "other-row" })).toBe(
      true,
    );
    expect(canRemoveSignInMethod(nothing, { kind: "account", accountId: "other-row" })).toBe(false);
  });
});
