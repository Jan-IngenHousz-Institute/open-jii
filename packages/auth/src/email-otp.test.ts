import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

import { DISABLED_EMAIL_OTP_PATHS, openJiiEmailOTP } from "./email-otp";

const REVIEW_EMAIL = "reviewer@example.com";
const REVIEW_OTP = "482913";
const OTHER_EMAIL = "researcher@example.com";
const REVIEW_LOG_LINE = "Issued the Play review sign-in code without sending an email";

type RequestableOTPType = "sign-in" | "email-verification" | "forget-password";

interface PlayReviewSettings {
  email: string | undefined;
  otp: string | undefined;
}

const configured: PlayReviewSettings = { email: REVIEW_EMAIL, otp: REVIEW_OTP };
const unconfigured: PlayReviewSettings = { email: undefined, otp: undefined };
const NON_SIGN_IN_TYPES: RequestableOTPType[] = ["email-verification", "forget-password"];

function createAuth(playReview: PlayReviewSettings) {
  const sendEmail = vi.fn((_message: { email: string; otp: string }) => Promise.resolve());
  const log = vi.fn();
  const tables = { user: [], session: [], account: [], verification: [] };

  const auth = betterAuth({
    baseURL: "http://localhost:3020",
    basePath: "/api/v1/auth",
    secret: "email-otp-test-secret-0123456789abcdef",
    logger: { level: "info", log },
    database: memoryAdapter(tables),
    disabledPaths: DISABLED_EMAIL_OTP_PATHS,
    plugins: [openJiiEmailOTP({ playReview, sendEmail })],
  });

  async function requestCode(email: string, type: RequestableOTPType) {
    await auth.api.sendVerificationOTP({ body: { email, type } });
    const { otp } = await auth.api.getVerificationOTP({ query: { email, type } });
    return otp;
  }

  function signIn(email: string, otp: string) {
    return auth.api.signInEmailOTP({ body: { email, otp } });
  }

  function checkCode(email: string, otp: string) {
    return auth.handler(
      new Request("http://localhost:3020/api/v1/auth/email-otp/check-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3020" },
        body: JSON.stringify({ email, type: "sign-in", otp }),
      }),
    );
  }

  return { requestCode, signIn, checkCode, sendEmail, log, tables };
}

describe("openJiiEmailOTP", () => {
  it("issues the configured code to the review email and sends nothing", async () => {
    const { requestCode, sendEmail, log } = createAuth(configured);

    expect(await requestCode(REVIEW_EMAIL, "sign-in")).toBe(REVIEW_OTP);
    expect(await requestCode("Reviewer@Example.COM", "sign-in")).toBe(REVIEW_OTP);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("info", REVIEW_LOG_LINE);
    expect(JSON.stringify(log.mock.calls)).not.toContain(REVIEW_OTP);
  });

  it("emails a generated code to every other address", async () => {
    const { requestCode, sendEmail } = createAuth(configured);

    const otp = await requestCode(OTHER_EMAIL, "sign-in");

    expect(otp).toMatch(/^\d{6}$/);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({ email: OTHER_EMAIL, otp, type: "sign-in" });
  });

  it.each(NON_SIGN_IN_TYPES)("emails a generated %s code to the review email", async (type) => {
    const { requestCode, signIn, sendEmail } = createAuth(configured);
    await requestCode(REVIEW_EMAIL, "sign-in");
    await signIn(REVIEW_EMAIL, REVIEW_OTP);

    const otp = await requestCode(REVIEW_EMAIL, type);

    expect(otp).toMatch(/^\d{6}$/);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({ email: REVIEW_EMAIL, otp, type });
  });

  it("treats the review email like any other when it is not configured", async () => {
    const { requestCode, sendEmail, log } = createAuth(unconfigured);

    const otp = await requestCode(REVIEW_EMAIL, "sign-in");

    expect(sendEmail).toHaveBeenCalledWith({ email: REVIEW_EMAIL, otp, type: "sign-in" });
    expect(log).not.toHaveBeenCalledWith("info", REVIEW_LOG_LINE);
  });

  it("refuses a partial configuration when it is built", () => {
    expect(() =>
      openJiiEmailOTP({
        playReview: { email: REVIEW_EMAIL, otp: undefined },
        sendEmail: () => Promise.resolve(),
      }),
    ).toThrow("AUTH_PLAY_REVIEW_EMAIL and AUTH_PLAY_REVIEW_OTP must be set together");
  });

  it("signs the reviewer in with the same code every time a code is requested", async () => {
    const { requestCode, signIn } = createAuth(configured);

    await requestCode(REVIEW_EMAIL, "sign-in");
    const first = await signIn(REVIEW_EMAIL, REVIEW_OTP);

    await expect(signIn(REVIEW_EMAIL, REVIEW_OTP)).rejects.toThrow("Invalid OTP");

    await requestCode(REVIEW_EMAIL, "sign-in");
    const second = await signIn(REVIEW_EMAIL, REVIEW_OTP);

    expect(second.user.id).toBe(first.user.id);
    expect(second.token).not.toBe(first.token);
  });

  it("stores the review code encrypted", async () => {
    const { requestCode, tables } = createAuth(configured);

    await requestCode(REVIEW_EMAIL, "sign-in");

    expect(tables.verification).toHaveLength(1);
    expect(JSON.stringify(tables.verification)).not.toContain(REVIEW_OTP);
  });

  it("offers no way to check a code without signing in", async () => {
    const { requestCode, checkCode } = createAuth(configured);
    await requestCode(REVIEW_EMAIL, "sign-in");

    const response = await checkCode(REVIEW_EMAIL, REVIEW_OTP);

    expect(response.status).toBe(404);
  });

  it("keeps the attempt limit on the review code", async () => {
    const { requestCode, signIn } = createAuth(configured);
    await requestCode(REVIEW_EMAIL, "sign-in");

    for (const wrongCode of ["000000", "111111", "222222"]) {
      await expect(signIn(REVIEW_EMAIL, wrongCode)).rejects.toThrow("Invalid OTP");
    }

    await expect(signIn(REVIEW_EMAIL, REVIEW_OTP)).rejects.toThrow("Too many attempts");

    await requestCode(REVIEW_EMAIL, "sign-in");
    const { user } = await signIn(REVIEW_EMAIL, REVIEW_OTP);

    expect(user.email).toBe(REVIEW_EMAIL);
  });

  it("refuses the review sign-in once the day's attempts are used up, even with the right code", async () => {
    const { requestCode, signIn, log } = createAuth(configured);
    for (let attempt = 0; attempt < 10; attempt++) {
      await requestCode(REVIEW_EMAIL, "sign-in");
      await signIn(REVIEW_EMAIL, REVIEW_OTP);
    }

    await requestCode(REVIEW_EMAIL, "sign-in");

    await expect(signIn(REVIEW_EMAIL, REVIEW_OTP)).rejects.toThrow("Too many sign-in attempts");
    expect(log).toHaveBeenCalledWith(
      "warn",
      "Play review sign-in refused: today's attempts are used up",
    );
  });

  it("does not count other addresses' sign-ins against the review cap", async () => {
    const { requestCode, signIn } = createAuth(configured);
    for (let attempt = 0; attempt < 11; attempt++) {
      const otp = await requestCode(OTHER_EMAIL, "sign-in");
      if (!otp) {
        throw new Error("Expected a sign-in code for the other address");
      }

      await signIn(OTHER_EMAIL, otp);
    }

    await requestCode(REVIEW_EMAIL, "sign-in");
    const { user } = await signIn(REVIEW_EMAIL, REVIEW_OTP);

    expect(user.email).toBe(REVIEW_EMAIL);
  });

  it("logs a failed review sign-in with its reason and without the address", async () => {
    const { requestCode, signIn, log } = createAuth(configured);
    await requestCode(REVIEW_EMAIL, "sign-in");

    await expect(signIn(REVIEW_EMAIL, "000000")).rejects.toThrow("Invalid OTP");

    expect(log).toHaveBeenCalledWith("warn", "Play review sign-in failed", {
      reason: "INVALID_OTP",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(REVIEW_EMAIL);
  });
});
