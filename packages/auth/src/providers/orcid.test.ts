import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { emailOTP, genericOAuth } from "better-auth/plugins";
import { afterEach, describe, expect, it, vi } from "vitest";

import { orcidProvider } from "./orcid";

const ORCID_ID = "0000-0002-1825-0097";
const BASE_URL = "http://localhost:3020";
const BASE_PATH = "/api/v1/auth";

interface RecordEmail {
  email: string;
  verified: boolean;
  primary: boolean;
}

const provider = orcidProvider({ clientId: "orcid-client", clientSecret: "s" });

function stubRecord(emails: RecordEmail[] | undefined, status = 200) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          person: {
            name: {
              "given-names": { value: "Josiah" },
              "family-name": { value: "Carberry" },
              "credit-name": null,
            },
            emails: {
              email: emails?.map((e) => ({ ...e, visibility: "public" })),
            },
          },
        }),
        { status, statusText: status === 200 ? "OK" : "Not Found" },
      ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getUserInfo(raw: Record<string, unknown> = { orcid: ORCID_ID }) {
  return provider.getUserInfo({ accessToken: "token", raw });
}

describe("orcidProvider getUserInfo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses a verified primary email", async () => {
    const fetchMock = stubRecord([
      { email: "j.carberry@example.com", verified: true, primary: true },
    ]);

    const user = await getUserInfo();

    expect(fetchMock).toHaveBeenCalledWith(`https://pub.orcid.org/v3.0/${ORCID_ID}`, {
      headers: { Accept: "application/json", Authorization: "Bearer token" },
    });
    expect(user).toEqual({
      id: ORCID_ID,
      name: "Josiah Carberry",
      email: "j.carberry@example.com",
      image: undefined,
      emailVerified: true,
    });
  });

  it("ignores an unverified public email and falls back to the iD", async () => {
    stubRecord([{ email: "j.carberry@example.com", verified: false, primary: true }]);

    const user = await getUserInfo();

    expect(user).toMatchObject({ email: ORCID_ID, emailVerified: false });
  });

  it("uses a verified secondary email over an unverified primary", async () => {
    stubRecord([
      { email: "unverified@example.com", verified: false, primary: true },
      { email: "verified@example.com", verified: true, primary: false },
    ]);

    const user = await getUserInfo();

    expect(user).toMatchObject({ email: "verified@example.com", emailVerified: true });
  });

  it("falls back to the iD when the record has no emails", async () => {
    stubRecord(undefined);

    const user = await getUserInfo();

    expect(user).toMatchObject({ email: ORCID_ID, emailVerified: false });
  });

  it("answers null, with a warning, when the token response carries no iD", async () => {
    const fetchMock = stubRecord([]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getUserInfo({})).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ORCID token response carried no iD");
  });

  it("answers null when the token response carries no access token", async () => {
    const fetchMock = stubRecord([]);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(provider.getUserInfo({ raw: { orcid: ORCID_ID } })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers null, logging the status and no token, when the record API refuses", async () => {
    stubRecord([], 404);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getUserInfo()).resolves.toBeNull();
    expect(warn.mock.calls).toEqual([["Failed to fetch the ORCID record", { status: 404 }]]);
  });

  it("answers null when the record API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getUserInfo()).resolves.toBeNull();
  });
});

describe("connecting ORCID when the record cannot be read", () => {
  const WEB = "http://localhost:3000";

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function cookiesFrom(response: Response, previous = "") {
    const fresh = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]);
    return [previous, ...fresh].filter(Boolean).join("; ");
  }

  it("returns to the error URL with unable_to_get_user_info and writes no account row", async () => {
    const tables = { user: [], session: [], account: [], verification: [] };
    const auth = betterAuth({
      baseURL: BASE_URL,
      basePath: BASE_PATH,
      secret: "orcid-record-failure-test-secret-0123456789",
      trustedOrigins: [WEB],
      database: memoryAdapter(tables),
      plugins: [
        emailOTP({ sendVerificationOTP: () => Promise.resolve() }),
        genericOAuth({
          config: [
            orcidProvider({ clientId: "orcid-client", clientSecret: "s", environment: "sandbox" }),
          ],
        }),
      ],
    });
    const request = (path: string, init: RequestInit) =>
      auth.handler(new Request(`${BASE_URL}${BASE_PATH}${path}`, init));

    const email = "researcher@example.com";
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });
    const signedIn = await request("/sign-in/email-otp", {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB },
      body: JSON.stringify({ email, otp }),
    });
    let cookie = cookiesFrom(signedIn);

    const linked = await request("/link-social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB, cookie },
      body: JSON.stringify({
        provider: "orcid",
        callbackURL: `${WEB}/security?connected=orcid`,
        errorCallbackURL: `${WEB}/security?connect=orcid`,
      }),
    });
    cookie = cookiesFrom(linked, cookie);
    const { url } = (await linked.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";

    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const target = input instanceof Request ? input.url : input.toString();
        if (target === "https://sandbox.orcid.org/oauth/token") {
          return Promise.resolve(
            Response.json({ access_token: "token", token_type: "bearer", orcid: ORCID_ID }),
          );
        }
        if (target === `https://pub.sandbox.orcid.org/v3.0/${ORCID_ID}`) {
          return Promise.resolve(new Response("unavailable", { status: 503 }));
        }
        return Promise.reject(new Error(`Unexpected fetch to ${target}`));
      }),
    );

    const callback = await request(`/callback/orcid?code=a-code&state=${state}`, {
      method: "GET",
      headers: { cookie },
    });

    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(`${WEB}/security`);
    expect(location.searchParams.get("connect")).toBe("orcid");
    expect(location.searchParams.get("error")).toBe("unable_to_get_user_info");
    expect(tables.account).toEqual([]);
  });
});

describe("orcidProvider redirectURI", () => {
  async function authorizationRedirectURI(redirectURI: string | undefined) {
    const auth = betterAuth({
      baseURL: BASE_URL,
      basePath: BASE_PATH,
      secret: "orcid-redirect-uri-test-secret-0123456789",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      plugins: [
        genericOAuth({
          config: [
            orcidProvider({
              clientId: "orcid-client",
              clientSecret: "s",
              environment: "sandbox",
              redirectURI,
            }),
          ],
        }),
      ],
    });
    const response = await auth.handler(
      new Request(`${BASE_URL}${BASE_PATH}/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ provider: "orcid", callbackURL: `${BASE_URL}/platform` }),
      }),
    );
    const body = (await response.json()) as { url: string };
    return new URL(body.url).searchParams.get("redirect_uri");
  }

  it("sends the registered address to ORCID when one is configured", async () => {
    const registered = "https://127.0.0.1:3443/api/v1/auth/oauth2/callback/orcid";

    await expect(authorizationRedirectURI(registered)).resolves.toBe(registered);
  });

  it("sends the backend's own callback when none is configured", async () => {
    await expect(authorizationRedirectURI(undefined)).resolves.toBe(
      `${BASE_URL}${BASE_PATH}/callback/orcid`,
    );
  });
});
