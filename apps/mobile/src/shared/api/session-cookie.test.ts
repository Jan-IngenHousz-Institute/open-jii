import { describe, expect, it } from "vitest";
import { hasSessionToken } from "~/shared/api/session-cookie";

describe("hasSessionToken", () => {
  it.each([
    "better-auth.dev.session_token=abc",
    "__Secure-better-auth.prod.session_token=abc",
    "better-auth.dev.oauth_state=x; better-auth.dev.session_token=abc",
  ])("accepts %j", (cookie) => {
    expect(hasSessionToken(cookie)).toBe(true);
  });

  it.each([
    undefined,
    null,
    "",
    "better-auth.dev.oauth_state=pending",
    "better-auth.dev.session_token=",
    "better-auth.dev.session_data=abc",
  ])("rejects %j", (cookie) => {
    expect(hasSessionToken(cookie)).toBe(false);
  });
});
