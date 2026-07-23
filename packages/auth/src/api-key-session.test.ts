import { describe, expect, it } from "vitest";

import { getApiKeyForSessionCheck } from "./api-key-session";

const API_KEY = "jii_test-key";
const apiKeyHeaders = new Headers({ "x-api-key": API_KEY });

describe("getApiKeyForSessionCheck", () => {
  it("accepts an API key for the AuthGuard get-session check", () => {
    expect(getApiKeyForSessionCheck({ path: "/get-session", headers: apiKeyHeaders })).toBe(
      API_KEY,
    );
  });

  it("does not authenticate auth-management routes with an API key", () => {
    const managementRoutes = [
      "/api-key/create",
      "/api-key/delete",
      "/passkey/generate-register-options",
      "/organization/update",
    ];

    for (const path of managementRoutes) {
      expect(getApiKeyForSessionCheck({ path, headers: apiKeyHeaders })).toBeNull();
    }
  });

  it("returns no key when the session check has no API-key header", () => {
    expect(getApiKeyForSessionCheck({ path: "/get-session", headers: new Headers() })).toBeNull();
  });
});
