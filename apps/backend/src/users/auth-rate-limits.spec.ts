import { Test } from "@nestjs/testing";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from "better-auth";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import requestHttp from "supertest";

import {
  consumeRateLimitCounter,
  deleteExpiredRateLimitCounters,
} from "@repo/auth/rate-limit/rate-limit.repository";
import type * as AuthServer from "@repo/auth/server";
import {
  db,
  eq,
  users,
  sessions,
  verifications,
  authRateLimitCounters,
  rateLimits,
  createSecondaryDatabase,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";

const { auth } = await vi.importActual<typeof AuthServer>("@repo/auth/server");
const authRequire = createRequire(import.meta.url);
const delivery = authRequire(
  join(dirname(authRequire.resolve("@repo/auth/server")), "email/otpEmail.js"),
) as {
  sendOtpEmail: (input: { to: string; otp: string }) => Promise<void>;
};
const base = `${auth.options.baseURL}/api/v1/auth`;
const sendPath = "/email-otp/send-verification-otp";
const email = () => `quota-${crypto.randomUUID()}@example.test`;
function request(path: string, viewer: string, body?: unknown, extra = {}) {
  return new Request(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-for": `${viewer}, 203.0.113.20`,
      "x-forwarded-proto": "https",
      "x-amzn-trace-id": "Root=1-example",
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const send = (recipient: string, viewer: string, extra = {}) =>
  auth.handler(request(sendPath, viewer, { email: recipient, type: "sign-in" }, extra));

describe("client and recipient limits through the configured auth handler", () => {
  const testApp = TestHarness.App;
  beforeAll(async () => {
    await testApp.setup();
    const context = await auth.$context;
    context.rateLimit.enabled = true;
  });
  beforeEach(async () => {
    await testApp.beforeEach();
    await db.delete(authRateLimitCounters);
    await db.delete(verifications);
    await db.delete(rateLimits);
    vi.stubEnv("AUTH_CLIENT_ADDRESS_MODE", "cloudfront-alb");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    testApp.afterEach();
  });
  afterAll(async () => {
    (await auth.$context).rateLimit.enabled = false;
    await testApp.teardown();
  });

  it.each([
    ["198.51.100.10", "198.51.100.11"],
    ["2001:db8::10", "2001:db8::11"],
    ["198.51.100.10", "2001:db8::11"],
  ])("isolates %s and %s despite forged header prefixes", async (a, b) => {
    for (let i = 0; i < 3; i++) expect((await send(email(), a)).status).toBe(200);
    for (const prefix of [b, "malformed, , 192.0.2.1", ""]) {
      const blocked = await send(email(), a, {
        "x-forwarded-for": `${prefix}, ${a}, 203.0.113.20`,
        "cloudfront-viewer-address": `${b}:444`,
        "x-openjii-resolved-client-address": b,
      });
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    }
    expect((await send(email(), b)).status).toBe(200);
    const counters = await db.select().from(authRateLimitCounters);
    expect(counters.every((row) => /^[a-f0-9]{64}$/.test(row.key))).toBe(true);
    expect(JSON.stringify(counters)).not.toContain(a);
    expect(await db.select().from(rateLimits)).toEqual([]);
  });

  it("rejects untrusted suffixes before storage or OTP generation", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const xff of [
      "",
      "198.51.100.1",
      "198.51.100.1,",
      "198.51.100.1, , 203.0.113.20",
      "bad, 203.0.113.20",
    ]) {
      const response = await send(email(), "198.51.100.1", {
        "x-forwarded-for": xff,
        "cloudfront-viewer-address": "198.51.100.1:1",
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "CLIENT_ADDRESS_UNAVAILABLE",
        message: "The client address could not be verified.",
      });
    }
    expect(await db.select().from(authRateLimitCounters)).toEqual([]);
    expect(await db.select().from(verifications)).toEqual([]);
    expect(warning.mock.calls.flat().join(" ")).not.toContain("198.51.100");
  });

  it("does not count repeated session reads from shared server-side egress", async () => {
    for (let i = 0; i < 110; i++) {
      expect((await auth.handler(request("/get-session", "198.51.100.1"))).status).toBe(200);
    }
    expect(await db.select().from(authRateLimitCounters)).toEqual([]);
  });

  it("bounds sends across addresses and keeps the last delivered code verifiable", async () => {
    const recipient = email();
    for (let i = 1; i <= 5; i++)
      expect((await send(recipient, `198.51.100.${i}`)).status).toBe(200);
    const before = await db.select().from(verifications);
    const counterBefore = await db
      .select()
      .from(authRateLimitCounters)
      .where(eq(authRateLimitCounters.route, "otp:send"));
    const blocked = await send(recipient.toUpperCase(), "198.51.100.6");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(890);
    expect(await db.select().from(verifications)).toEqual(before);
    expect(
      await db
        .select()
        .from(authRateLimitCounters)
        .where(eq(authRateLimitCounters.route, "otp:send")),
    ).toEqual(counterBefore);
    const otp = await auth.api.getVerificationOTP({ query: { email: recipient, type: "sign-in" } });
    const signedIn = await auth.handler(
      request(
        "/sign-in/email-otp",
        "198.51.100.7",
        { email: recipient, otp: otp.otp },
        { "expo-origin": "openjii://" },
      ),
    );
    expect(signedIn.status).toBe(200);
    const savedSessions = await db.select().from(sessions);
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].ipAddress).toBe("");
    expect((await send(email(), "198.51.100.8")).status).toBe(200);
    const serialized = JSON.stringify(await db.select().from(authRateLimitCounters));
    expect(serialized).not.toContain(recipient);
    expect(serialized).not.toContain("198.51.100");
  });

  it("shares the quota between all enabled public OTP send routes", async () => {
    const recipient = email();
    await db.insert(users).values({ email: recipient, name: "Quota user" });
    const paths = [sendPath, "/email-otp/request-password-reset", "/forget-password/email-otp"];
    for (let i = 0; i < 5; i++) {
      const response = await auth.handler(
        request(paths[i % paths.length], `198.51.100.${i + 1}`, {
          email: recipient,
          type: "sign-in",
        }),
      );
      expect(response.status).toBe(200);
    }
    for (const path of paths)
      expect(
        (await auth.handler(request(path, "198.51.100.9", { email: recipient, type: "sign-in" })))
          .status,
      ).toBe(429);
    const bodies = Object.values(auth.api)
      .filter(
        (endpoint) =>
          endpoint.path &&
          /(?:send-verification-otp|request-password-reset|forget-password\/email-otp)$/.test(
            endpoint.path,
          ),
      )
      .map((endpoint) => endpoint.path)
      .sort();
    expect(bodies).toEqual([...paths, "/request-password-reset"].sort());
    expect(auth.options.emailAndPassword.enabled).toBe(false);
  });

  it("retains OTP guess protection when an attacker rotates addresses", async () => {
    const recipient = email();
    expect((await send(recipient, "198.51.100.1")).status).toBe(200);
    const { otp } = await auth.api.getVerificationOTP({
      query: { email: recipient, type: "sign-in" },
    });
    for (let i = 1; i <= 3; i++) {
      expect(
        (
          await auth.handler(
            request("/sign-in/email-otp", `198.51.100.${i + 1}`, {
              email: recipient,
              otp: "invalid",
            }),
          )
        ).status,
      ).toBe(400);
    }
    const exhausted = await auth.handler(
      request("/sign-in/email-otp", "198.51.100.10", { email: recipient, otp }),
    );
    expect(exhausted.status).not.toBe(200);
  });

  it("reaches the protected wrapper through the Nest Better Auth adapter", async () => {
    const module = await Test.createTestingModule({
      imports: [BetterAuthModule.forRoot({ auth })],
    }).compile();
    const app = module.createNestApplication({ bodyParser: false });
    await app.init();
    try {
      const response = await requestHttp(app.getHttpServer())
        .post("/api/v1/auth/email-otp/send-verification-otp")
        .set("Origin", "http://localhost:3000")
        .set("X-Forwarded-For", "forged-single-entry")
        .send({ email: email(), type: "sign-in" });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: "CLIENT_ADDRESS_UNAVAILABLE" });
    } finally {
      await app.close();
    }
  });

  it("suppresses session IP on renewal as well as creation", async () => {
    const recipient = email();
    const otp = await auth.api.createVerificationOTP({
      body: { email: recipient, type: "sign-in" },
    });
    const response = await auth.handler(
      request("/sign-in/email-otp", "198.51.100.1", { email: recipient, otp }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const [session] = await db.select().from(sessions);
    await db
      .update(sessions)
      .set({
        ipAddress: "198.51.100.99",
        updatedAt: new Date(Date.now() - 172800000),
        expiresAt: new Date(Date.now() + 86400000),
      })
      .where(eq(sessions.id, session.id));
    const renewed = await auth.handler(
      request("/get-session?disableCookieCache=true", "198.51.100.2", undefined, { cookie }),
    );
    expect(renewed.status).toBe(200);
    const [after] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(after.ipAddress).toBe("");
    expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 86400000);
  });

  it("does not disclose whether an exhausted recipient has an account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const known = email();
      const unknown = email();
      await db.insert(users).values({ email: known, name: "Known user" });
      for (let i = 0; i < 5; i++) {
        expect((await send(known, `198.51.100.${i + 1}`)).status).toBe(200);
        expect((await send(unknown, `192.0.2.${i + 1}`)).status).toBe(200);
      }
      const a = await send(known, "198.51.100.20");
      const b = await send(unknown, "192.0.2.20");
      expect(a.status).toBe(429);
      expect(b.status).toBe(a.status);
      expect(b.headers.get("Retry-After")).toBe(a.headers.get("Retry-After"));
      expect(await b.json()).toEqual(await a.json());
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps counters across fresh auth instances and separates one viewer's route keys", async () => {
    for (let i = 0; i < 3; i++) expect((await send(email(), "198.51.100.1")).status).toBe(200);
    const fresh = betterAuth({
      ...auth.options,
      rateLimit: { ...auth.options.rateLimit, enabled: true },
    });
    // The new instance consumes the same private storage; the app wrapper stamps this header.
    const blocked = await fresh.handler(
      request(
        sendPath,
        "198.51.100.1",
        { email: email(), type: "sign-in" },
        {
          "x-openjii-resolved-client-address": "198.51.100.1",
        },
      ),
    );
    expect(blocked.status).toBe(429);
    await auth.handler(
      request("/sign-in/email-otp", "198.51.100.1", { email: email(), otp: "invalid" }),
    );
    const counters = await db.select().from(authRateLimitCounters);
    const sends = counters.find((row) => row.route === sendPath);
    const verifies = counters.find((row) => row.route === "/sign-in/email-otp");
    expect(sends?.key).toMatch(/^[a-f0-9]{64}$/);
    expect(verifies?.key).toMatch(/^[a-f0-9]{64}$/);
    expect(sends?.key).not.toBe(verifies?.key);
  });

  it("admits at most five actual deliveries during concurrent rotating-address sends", async () => {
    vi.stubEnv("AUTH_EMAIL_SERVER", "smtp://localhost:2525");
    vi.stubEnv("AUTH_EMAIL_FROM", "sender@example.test");
    const deliver = vi.spyOn(delivery, "sendOtpEmail").mockResolvedValue(undefined);
    const recipient = email();
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => send(recipient, `198.51.100.${i + 1}`)),
    );
    expect(responses.filter((response) => response.status === 200)).toHaveLength(5);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(7);
    expect(deliver).toHaveBeenCalledTimes(5);
  });

  it("fails closed when quota persistence fails and does not generate a code", async () => {
    const before = await db.select().from(verifications);
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("quota storage unavailable");
    });
    await expect(send(email(), "198.51.100.1")).rejects.toThrow("quota storage unavailable");
    expect(await db.select().from(verifications)).toEqual(before);
  });

  it("does not consume a recipient quota for invalid recipients or disabled email-change sends", async () => {
    for (const body of [
      { email: "invalid", type: "sign-in" },
      { email: email(), type: "change-email" },
    ]) {
      expect((await auth.handler(request(sendPath, "198.51.100.1", body))).status).toBe(400);
    }
    expect(
      await db
        .select()
        .from(authRateLimitCounters)
        .where(eq(authRateLimitCounters.route, "otp:send")),
    ).toEqual([]);
    expect(await db.select().from(verifications)).toEqual([]);
  });

  it("atomically admits only five recipients' send attempts across independent connections", async () => {
    const other = createSecondaryDatabase();
    const input = {
      key: "test-hmac-counter",
      route: "otp:send",
      now: new Date(),
      window: 900,
      max: 5,
      sliding: false,
    };
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          consumeRateLimitCounter(i % 2 ? other.database : db, input),
        ),
      );
      expect(results.filter((result) => result.allowed)).toHaveLength(5);
      expect((await db.select().from(authRateLimitCounters))[0].count).toBe(5);
      const expired = await consumeRateLimitCounter(db, {
        ...input,
        now: new Date(input.now.getTime() + 900_001),
      });
      expect(expired.allowed).toBe(true);
    } finally {
      await other.close();
    }
  });

  it("supports scheduled route-specific cleanup without deleting other routes or live rows", async () => {
    const now = new Date();
    const entries = [
      ["expired-anonymous", "/sign-in/anonymous", -1],
      ["live-anonymous", "/sign-in/anonymous", 60000],
      ["expired-email", "otp:send", -1],
      ["live-email", "otp:send", 60000],
    ] as const;
    await db.insert(authRateLimitCounters).values(
      entries.map(([key, route, offset]) => ({
        key,
        route,
        count: 1,
        lastRequest: now.getTime(),
        expiresAt: new Date(now.getTime() + offset),
      })),
    );
    expect(await deleteExpiredRateLimitCounters(db, { now, route: "/sign-in/anonymous" })).toBe(1);
    expect((await db.select().from(authRateLimitCounters)).map((row) => row.key).sort()).toEqual([
      "expired-email",
      "live-anonymous",
      "live-email",
    ]);
    expect(await deleteExpiredRateLimitCounters(db, { now })).toBe(1);
  });
});
