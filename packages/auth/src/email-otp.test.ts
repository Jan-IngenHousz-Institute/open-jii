import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { PLAY_REVIEW_LOG_LINES, openJiiEmailOTP } from "./email-otp";

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
const AUTH_URL = "http://localhost:3020/api/v1/auth";

const repoRoot = resolve(__dirname, "../../..");
const playReviewModulePath = "infrastructure/modules/play-review-sign-in/main.tf";

function createAuth(playReview: PlayReviewSettings) {
  const sendEmail = vi.fn((_message: { email: string; otp: string }) => Promise.resolve());
  const log = vi.fn();
  const tables = {
    user: [],
    session: [],
    account: [],
    verification: [],
    apikey: [],
    passkey: [],
  };

  const auth = betterAuth({
    baseURL: "http://localhost:3020",
    basePath: "/api/v1/auth",
    secret: "email-otp-test-secret-0123456789abcdef",
    logger: { level: "info", log },
    database: memoryAdapter(tables),
    user: { changeEmail: { enabled: true } },
    plugins: [
      openJiiEmailOTP({ playReview, sendEmail }),
      apiKey(),
      passkey({ rpID: "localhost", rpName: "openJII", origin: "http://localhost:3020" }),
    ],
  });

  async function requestCode(email: string, type: RequestableOTPType) {
    await auth.api.sendVerificationOTP({ body: { email, type } });
    const { otp } = await auth.api.getVerificationOTP({ query: { email, type } });
    return otp;
  }

  function signIn(email: string, otp: string) {
    return auth.api.signInEmailOTP({ body: { email, otp } });
  }

  function request(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
    const { method = "POST", body, cookie } = init;
    return auth.handler(
      new Request(`${AUTH_URL}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3020",
          ...(cookie ? { cookie } : {}),
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
      }),
    );
  }

  function checkCode(email: string, otp: string) {
    return request("/email-otp/check-verification-otp", {
      body: { email, type: "sign-in", otp },
    });
  }

  async function sessionCookie(email: string) {
    const otp = await requestCode(email, "sign-in");
    if (!otp) {
      throw new Error(`Expected a sign-in code for ${email}`);
    }

    const { headers } = await auth.api.signInEmailOTP({
      body: { email, otp },
      returnHeaders: true,
    });
    return headers
      .getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0])
      .join("; ");
  }

  return { requestCode, signIn, request, checkCode, sessionCookie, sendEmail, log, tables };
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
    expect(log).toHaveBeenCalledWith("warn", PLAY_REVIEW_LOG_LINES.signInRefused, {
      reason: "daily cap",
    });
  });

  it("counts neither a body without a code nor one with a numeric code against the cap", async () => {
    const { request, requestCode, signIn, log } = createAuth(configured);
    for (let attempt = 0; attempt < 10; attempt++) {
      await request("/sign-in/email-otp", { body: { email: REVIEW_EMAIL } });
    }
    await request("/sign-in/email-otp", { body: { email: REVIEW_EMAIL, otp: 482913 } });

    await requestCode(REVIEW_EMAIL, "sign-in");
    const { user } = await signIn(REVIEW_EMAIL, REVIEW_OTP);

    expect(user.email).toBe(REVIEW_EMAIL);
    expect(log).not.toHaveBeenCalledWith("warn", PLAY_REVIEW_LOG_LINES.signInRefused, {
      reason: "daily cap",
    });
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

    expect(log).toHaveBeenCalledWith("warn", PLAY_REVIEW_LOG_LINES.signInFailed, {
      reason: "INVALID_OTP",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(REVIEW_EMAIL);
  });

  it("logs a successful review sign-in, and nothing for other addresses", async () => {
    const { requestCode, signIn, log } = createAuth(configured);
    const otherOtp = await requestCode(OTHER_EMAIL, "sign-in");
    if (!otherOtp) {
      throw new Error("Expected a sign-in code for the other address");
    }
    await signIn(OTHER_EMAIL, otherOtp);

    expect(log).not.toHaveBeenCalledWith("info", PLAY_REVIEW_LOG_LINES.signInSucceeded);

    await requestCode(REVIEW_EMAIL, "sign-in");
    await signIn(REVIEW_EMAIL, REVIEW_OTP);

    expect(log).toHaveBeenCalledWith("info", PLAY_REVIEW_LOG_LINES.signInSucceeded);
  });

  it.each([
    ["POST", "/api-key/create"],
    ["GET", "/passkey/generate-register-options"],
    ["POST", "/passkey/verify-registration"],
    ["POST", "/link-social"],
    ["POST", "/change-email"],
    ["POST", "/email-otp/request-email-change"],
    ["POST", "/email-otp/change-email"],
  ])("refuses %s %s for the review account and logs it", async (method, path) => {
    const { request, sessionCookie, log } = createAuth(configured);
    const cookie = await sessionCookie(REVIEW_EMAIL);

    const response = await request(path, { method, cookie, body: { name: "Laptop" } });

    expect(response.status).toBe(403);
    expect(log).toHaveBeenCalledWith("warn", PLAY_REVIEW_LOG_LINES.newSignInMethodRefused, {
      path,
    });
  });

  it.each([
    ["POST", "/api-key/create"],
    ["GET", "/passkey/generate-register-options"],
  ])("still lets everyone else use %s %s", async (method, path) => {
    const { request, sessionCookie } = createAuth(configured);
    const cookie = await sessionCookie(OTHER_EMAIL);

    const response = await request(path, { method, cookie, body: { name: "Laptop" } });

    expect(response.status).toBe(200);
  });

  it("matches every line it logs in the backend's metric filter", () => {
    const filter = readFileSync(join(repoRoot, playReviewModulePath), "utf8");

    for (const line of Object.values(PLAY_REVIEW_LOG_LINES)) {
      expect(filter).toContain(`?\\"${line}\\"`);
    }
  });
});
