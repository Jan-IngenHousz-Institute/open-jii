import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { genericOAuth } from "better-auth/plugins";
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

    expect(user.email).toBe(ORCID_ID);
    expect(user.emailVerified).toBe(false);
  });

  it("uses a verified secondary email over an unverified primary", async () => {
    stubRecord([
      { email: "unverified@example.com", verified: false, primary: true },
      { email: "verified@example.com", verified: true, primary: false },
    ]);

    const user = await getUserInfo();

    expect(user.email).toBe("verified@example.com");
    expect(user.emailVerified).toBe(true);
  });

  it("falls back to the iD when the record has no emails", async () => {
    stubRecord(undefined);

    const user = await getUserInfo();

    expect(user.email).toBe(ORCID_ID);
    expect(user.emailVerified).toBe(false);
  });

  it("throws when the token response carries no iD", async () => {
    const fetchMock = stubRecord([]);

    await expect(getUserInfo({})).rejects.toThrow("ORCID ID not found in token response");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the record API answers with an error", async () => {
    stubRecord([], 404);

    await expect(getUserInfo()).rejects.toThrow("Failed to fetch ORCID record: Not Found");
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
