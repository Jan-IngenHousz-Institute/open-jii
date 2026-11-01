import { describe, expect, it } from "vitest";

import { PlayReviewAccount } from "./play-review-account";

type OTPType = Parameters<PlayReviewAccount["generateOTP"]>[0]["type"];

const OTP_LENGTH = 6;
const REVIEW_EMAIL = "reviewer@example.com";
const REVIEW_OTP = "482913";
const NON_SIGN_IN_TYPES: OTPType[] = ["email-verification", "forget-password", "change-email"];

function reviewAccount(email: string | undefined, otp: string | undefined) {
  return PlayReviewAccount.fromSettings({ email, otp, otpLength: OTP_LENGTH });
}

function configuredAccount(email = REVIEW_EMAIL) {
  const account = reviewAccount(email, REVIEW_OTP);
  if (!account) {
    throw new Error("Expected the review account to be configured");
  }

  return account;
}

describe("PlayReviewAccount.fromSettings", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("is off when both settings are %s", (_label, value) => {
    expect(reviewAccount(value, value)).toBeNull();
  });

  it.each([
    ["only the email", REVIEW_EMAIL, undefined],
    ["only the code", undefined, REVIEW_OTP],
    ["an empty code", REVIEW_EMAIL, ""],
  ])("refuses %s", (_label, email, otp) => {
    expect(() => reviewAccount(email, otp)).toThrow(
      "AUTH_PLAY_REVIEW_EMAIL and AUTH_PLAY_REVIEW_OTP must be set together",
    );
  });

  it.each(["reviewer", "reviewer@", "reviewer @example.com", `${REVIEW_EMAIL}\n`])(
    "refuses the email %j",
    (email) => {
      expect(() => reviewAccount(email, REVIEW_OTP)).toThrow(
        "AUTH_PLAY_REVIEW_EMAIL is not a valid email address",
      );
    },
  );

  it.each(["48291", "4829130", "48291a", "482 91", `${REVIEW_OTP}\n`])(
    "refuses the code %j",
    (otp) => {
      expect(() => reviewAccount(REVIEW_EMAIL, otp)).toThrow(
        "AUTH_PLAY_REVIEW_OTP must be exactly 6 digits",
      );
    },
  );
});

describe("PlayReviewAccount", () => {
  it("issues the configured code for a sign-in to the review email", () => {
    const account = configuredAccount();

    expect(account.generateOTP({ email: REVIEW_EMAIL, type: "sign-in" })).toBe(REVIEW_OTP);
    expect(account.isReviewSignIn({ email: REVIEW_EMAIL, type: "sign-in" })).toBe(true);
  });

  it("matches the review email in any case", () => {
    const account = configuredAccount("Reviewer@Example.COM");

    expect(account.generateOTP({ email: REVIEW_EMAIL, type: "sign-in" })).toBe(REVIEW_OTP);
    expect(account.generateOTP({ email: "REVIEWER@example.com", type: "sign-in" })).toBe(
      REVIEW_OTP,
    );
  });

  it.each(NON_SIGN_IN_TYPES)("leaves %s codes for the review email to Better Auth", (type) => {
    const account = configuredAccount();

    expect(account.generateOTP({ email: REVIEW_EMAIL, type })).toBeUndefined();
    expect(account.isReviewSignIn({ email: REVIEW_EMAIL, type })).toBe(false);
  });

  it("leaves sign-in codes for every other email to Better Auth", () => {
    const account = configuredAccount();

    expect(account.generateOTP({ email: "someone@example.com", type: "sign-in" })).toBeUndefined();
    expect(account.isReviewSignIn({ email: "someone@example.com", type: "sign-in" })).toBe(false);
  });
});
