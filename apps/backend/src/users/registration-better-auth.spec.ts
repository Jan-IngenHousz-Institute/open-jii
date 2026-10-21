import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";

import type * as AuthServer from "@repo/auth/server";
import { db, eq, users, profiles } from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { CreateUserProfileUseCase } from "./application/use-cases/create-user-profile/create-user-profile";

// TestHarness mocks auth.server; importActual exercises the production configuration.
const { auth } = await vi.importActual<typeof AuthServer>("@repo/auth/server");
const rejection = {
  code: "REGISTRATION_FIELD_FORBIDDEN",
  message: "Registration can only be completed by saving a profile.",
};
const base = `${auth.options.baseURL}/api/v1/auth`;
const origin = "http://localhost:3000";

function request(path: string, body: unknown, cookie = "", extraHeaders = {}) {
  return new Request(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie, ...extraHeaders },
    body: JSON.stringify(body),
  });
}
function cookies(response: Response, previous = "") {
  const jar = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        return [cookie.slice(0, separator), cookie.slice(separator + 1)];
      }),
  );
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const separator = pair.indexOf("=");
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}
async function signIn() {
  const email = `registration-${crypto.randomUUID()}@example.test`;
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  const response = await auth.handler(
    request("/sign-in/email-otp", { email, otp }, "", {
      "expo-origin": "openjii://",
    }),
  );
  expect(response.status).toBe(200);
  const result = (await response.json()) as { user: { id: string; registered: boolean } };
  expect(result.user.registered).toBe(false);
  return { id: result.user.id, cookie: cookies(response) };
}
async function stored(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

describe("server-owned registration on the real auth HTTP boundary", () => {
  const testApp = TestHarness.App;
  beforeAll(() => testApp.setup());
  beforeEach(() => testApp.beforeEach());
  afterEach(() => testApp.afterEach());
  afterAll(() => testApp.teardown());

  it("enumerates every production body endpoint and rejects registration input before routing", async () => {
    const endpoints = Object.entries(auth.api).filter(([, endpoint]) => "body" in endpoint.options);
    const inventory = endpoints
      .map(([name, endpoint]) => ({
        name,
        path: endpoint.path || null,
        classification: endpoint.path
          ? "HTTP: registration forbidden"
          : "server-only: no HTTP route",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(inventory).toMatchSnapshot();
    for (const [, endpoint] of endpoints) {
      if (!endpoint.path) continue;
      for (const body of [{ registered: false }, { data: { registered: true } }]) {
        const response = await auth.handler(request(endpoint.path, body));
        expect(response.status, endpoint.path).toBe(400);
        expect(await response.json(), endpoint.path).toEqual(rejection);
      }
    }
  });

  it("guards a future plugin endpoint without adding its route to the guard", async () => {
    const future = betterAuth({
      ...auth.options,
      plugins: [
        ...auth.options.plugins,
        {
          id: "future-registration-test",
          endpoints: {
            futureWriter: createAuthEndpoint(
              "/future-writer",
              {
                method: "POST",
                body: z.record(z.string(), z.unknown()),
              },
              () => Promise.resolve({ reached: true }),
            ),
          },
        },
      ],
    });
    const response = await future.handler(
      request("/future-writer", { data: { registered: false } }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(rejection);
  });

  it.each(["urlencoded", "multipart"])(
    "rejects %s registration input before routing",
    async (encoding) => {
      const form = encoding === "urlencoded" ? new URLSearchParams() : new FormData();
      form.set("registered", "false");
      const response = await auth.handler(
        new Request(`${base}/update-user`, {
          method: "POST",
          headers: { origin },
          body: form,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(rejection);
    },
  );

  it.each([false, true])(
    "refuses every supplied value without changing a registered=%s user",
    async (registered) => {
      const user = await signIn();
      if (registered) {
        const saved = await testApp.module
          .get(CreateUserProfileUseCase)
          .execute({ firstName: "Test", lastName: "Researcher" }, user.id);
        expect(saved.isSuccess()).toBe(true);
      }
      const before = await stored(user.id);
      for (const value of [true, false, null, "true", "false", ""]) {
        for (const body of [
          { registered: value },
          { name: "Must not persist", registered: value },
          { data: { registered: value } },
          JSON.parse(`{"__proto__":{"registered":${JSON.stringify(value)}}}`) as unknown,
          JSON.parse(`{"__proto__":{},"registered":${JSON.stringify(value)}}`) as unknown,
        ]) {
          const response = await auth.handler(request("/update-user", body, user.cookie));
          expect(response.status).toBe(400);
          expect(await response.json()).toEqual(rejection);
        }
      }
      expect(await stored(user.id)).toEqual(before);
      expect(Object.prototype).not.toHaveProperty("registered");
    },
  );

  it("does not map alternative spellings to registered or let userId choose another user", async () => {
    const user = await signIn();
    const other = await signIn();
    for (const key of ["isRegistered", "is_registered", "Registered", "REGISTERED"]) {
      const response = await auth.handler(
        request("/update-user", { name: "Allowed", [key]: true, userId: other.id }, user.cookie),
      );
      expect(response.status).toBe(200);
    }
    expect((await stored(user.id)).registered).toBe(false);
    expect((await stored(other.id)).registered).toBe(false);
    expect((await stored(other.id)).name).not.toBe("Allowed");
  });

  it("rejects an API key and an unauthenticated registration write with the same error", async () => {
    const user = await signIn();
    const key = await auth.api.createApiKey({
      headers: new Headers({ cookie: user.cookie }),
      body: { name: "Registration test" },
    });
    for (const headers of [{}, { "x-api-key": key.key }]) {
      const response = await auth.handler(
        request("/update-user", { registered: true }, "", headers),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(rejection);
    }
    expect((await stored(user.id)).registered).toBe(false);
  });

  it("preserves ordinary updates and refreshes a stale cookie only after the profile writer succeeds", async () => {
    const user = await signIn();
    const update = await auth.handler(
      request(
        "/update-user",
        { name: "Allowed", image: "https://example.test/avatar.png" },
        user.cookie,
      ),
    );
    expect(update.status).toBe(200);
    expect((await stored(user.id)).registered).toBe(false);
    const getSession = (cookie: string, bypass = false) =>
      auth.handler(
        new Request(`${base}/get-session${bypass ? "?disableCookieCache=true" : ""}`, {
          headers: { cookie },
        }),
      );
    const cached = await getSession(user.cookie);
    expect(await cached.json()).toMatchObject({ user: { registered: false } });
    const staleCookie = cookies(cached, user.cookie);
    const saved = await testApp.module
      .get(CreateUserProfileUseCase)
      .execute({ firstName: "Fresh", lastName: "Researcher" }, user.id);
    expect(saved.isSuccess()).toBe(true);
    expect((await stored(user.id)).registered).toBe(true);
    expect(await db.select().from(profiles).where(eq(profiles.userId, user.id))).toHaveLength(1);
    expect(await (await getSession(staleCookie)).json()).toMatchObject({
      user: { registered: false },
    });
    const refreshed = await getSession(staleCookie, true);
    expect(await refreshed.json()).toMatchObject({ user: { registered: true } });
    expect(await (await getSession(cookies(refreshed, staleCookie))).json()).toMatchObject({
      user: { registered: true },
    });
  });

  it("allows a new Expo OTP session with no profile and rejects supplied registration during sign-in", async () => {
    const user = await signIn();
    expect((await stored(user.id)).registered).toBe(false);
    expect(await db.select().from(profiles).where(eq(profiles.userId, user.id))).toHaveLength(0);
    for (const body of [{ registered: true }, { data: { registered: false } }]) {
      const response = await auth.handler(request("/sign-in/email-otp", body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(rejection);
    }
    const signup = await auth.handler(
      request("/sign-up/email", {
        email: "unused@example.test",
        password: "long-password",
        name: "Unused",
      }),
    );
    expect(signup.status).not.toBe(200);
  });
});
