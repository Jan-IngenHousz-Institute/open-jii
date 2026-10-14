import { afterEach, describe, expect, it, vi } from "vitest";
import { isApiStatus } from "~/features/experiments/utils/api-error";

import { getCredentials } from "./aws-iot-auth";

// The real oRPC client and getCredentials run here, with only fetch stubbed, so
// these pin what the MQTT session classifies: a status only on a backend answer.
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://api.example.invalid",
}));
vi.mock("~/shared/time/time-sync", () => ({
  ensureSynced: vi.fn(),
  getSyncedUtcDateTime: vi.fn(),
  getSyncedUtcNow: () => Date.now(),
  getTimeSyncState: vi.fn(),
}));
vi.mock("crypto-js", () => ({ HmacSHA256: vi.fn(), SHA256: vi.fn(), enc: {}, lib: {} }));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function failureFor(respond: () => Promise<Response>): Promise<unknown> {
  vi.stubGlobal("fetch", vi.fn(respond));
  return getCredentials().then(
    () => new Error("getCredentials resolved"),
    (err: unknown) => err,
  );
}

const json = (status: number) =>
  new Response(JSON.stringify({ code: "ERROR", message: "refused" }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("getCredentials failures through the real oRPC client", () => {
  it("carries no status when the request got no answer", async () => {
    const err = await failureFor(() => Promise.reject(new TypeError("Network request failed")));

    expect(err).toBeInstanceOf(TypeError);
    expect(isApiStatus(err, 400, 401, 403, 404, 500, 503)).toBe(false);
  });

  it("carries no status when a captive portal answers 200 with HTML", async () => {
    const err = await failureFor(() =>
      Promise.resolve(
        new Response("<html>portal</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    expect(err).toBeInstanceOf(Error);
    expect(isApiStatus(err, 400, 401, 403, 404, 500, 503)).toBe(false);
  });

  it("carries the status of a refusal and of a server error", async () => {
    expect(isApiStatus(await failureFor(() => Promise.resolve(json(401))), 401)).toBe(true);
    expect(isApiStatus(await failureFor(() => Promise.resolve(json(503))), 503)).toBe(true);
  });
});
