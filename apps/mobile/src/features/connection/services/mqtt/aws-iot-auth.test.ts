import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCredentials = vi.fn();

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({
    iot: {
      getCredentials: mockGetCredentials,
    },
  }),
}));

// Stub out the rest of the module's heavy/native imports.
vi.mock("paho-mqtt", () => ({ Client: vi.fn(), Message: vi.fn() }));
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: () => "stub" }));
vi.mock("~/shared/time/time-sync", () => ({
  ensureSynced: vi.fn().mockResolvedValue(undefined),
  // createSignedUrl calls .toFormat on the returned DateTime; return a stub that
  // echoes the format so signing proceeds deterministically.
  getSyncedUtcDateTime: vi.fn(() => ({ toFormat: (fmt: string) => fmt })),
  // Tests drive time via vi.setSystemTime, so the "synced" clock is Date.now().
  getSyncedUtcNow: vi.fn(() => Date.now()),
  getTimeSyncState: vi.fn(() => ({ timezone: "UTC" })),
}));
vi.mock("~/features/connection/utils/emitter", () => ({ Emitter: vi.fn() }));
vi.mock("~/features/connection/utils/generate-random-string", () => ({
  generateRandomString: () => "rand",
}));
vi.mock("crypto-js", () => ({
  HmacSHA256: () => ({ toString: () => "h" }),
  SHA256: () => ({ toString: () => "s" }),
  enc: { Hex: {} },
  lib: { WordArray: class {} },
}));

const okResponse = (expiration: string) => ({
  status: 200 as const,
  body: {
    accessKeyId: "AKIA-EXAMPLE",
    secretAccessKey: "secret-example",
    sessionToken: "session-example",
    expiration,
  },
});

interface Mod {
  getCredentials: () => Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }>;
  createSignedUrl: (params: {
    clientId: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;
    endpoint: string;
  }) => Promise<string>;
  _resetCredentialsCacheForTests: () => void;
}

async function freshModule(): Promise<Mod> {
  return (await import("~/features/connection/services/mqtt/aws-iot-auth")) as unknown as Mod;
}

describe("getCredentials — backend endpoint", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    const mod = await freshModule();
    mod._resetCredentialsCacheForTests();
  });

  it("returns the credentials the contract returns", async () => {
    mockGetCredentials.mockResolvedValue(okResponse(new Date(Date.now() + 3600_000).toISOString()));

    const mod = await freshModule();
    const creds = await mod.getCredentials();

    expect(creds).toEqual({
      accessKeyId: "AKIA-EXAMPLE",
      secretAccessKey: "secret-example",
      sessionToken: "session-example",
    });
    expect(mockGetCredentials).toHaveBeenCalledTimes(1);
  });

  it("returns cached credentials on a second call without refetching", async () => {
    mockGetCredentials.mockResolvedValue(okResponse(new Date(Date.now() + 3600_000).toISOString()));

    const mod = await freshModule();
    await mod.getCredentials();
    await mod.getCredentials();

    expect(mockGetCredentials).toHaveBeenCalledTimes(1);
  });

  it("re-fetches once the reported expiration has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));
    mockGetCredentials.mockImplementation(() =>
      Promise.resolve(okResponse(new Date(Date.now() + 30 * 60_000).toISOString())),
    );

    const mod = await freshModule();
    await mod.getCredentials();

    vi.setSystemTime(new Date("2026-05-13T12:31:00Z"));
    await mod.getCredentials();

    expect(mockGetCredentials).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when within the safety margin of expiration (under 60s remaining)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));
    mockGetCredentials.mockImplementation(() =>
      Promise.resolve(okResponse(new Date(Date.now() + 60 * 60_000).toISOString())),
    );

    const mod = await freshModule();
    await mod.getCredentials();

    // 30 seconds before expiration — within the 60s safety margin
    vi.setSystemTime(new Date("2026-05-13T12:59:30Z"));
    await mod.getCredentials();

    expect(mockGetCredentials).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent in-flight fetches into one request", async () => {
    let resolveCreds: (v: unknown) => void = () => undefined;
    const pending = new Promise((r) => {
      resolveCreds = r;
    });
    mockGetCredentials.mockReturnValue(pending);

    const mod = await freshModule();
    const promises = [mod.getCredentials(), mod.getCredentials(), mod.getCredentials()];

    resolveCreds(okResponse(new Date(Date.now() + 3600_000).toISOString()));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    expect(mockGetCredentials).toHaveBeenCalledTimes(1);
  });

  it("throws on a non-200 (e.g. 401 signed-out) and does not cache", async () => {
    mockGetCredentials.mockResolvedValueOnce({ status: 401, body: { message: "Unauthorized" } });

    const mod = await freshModule();
    await expect(mod.getCredentials()).rejects.toThrow("Failed to fetch IoT credentials: 401");

    // Next caller retries rather than returning a poisoned cache.
    mockGetCredentials.mockResolvedValue(okResponse(new Date(Date.now() + 3600_000).toISOString()));
    const creds = await mod.getCredentials();
    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
  });

  it("rejects credentials that are already expired or expire within the safety margin", async () => {
    // Expires in 30s — inside the 60s safety margin, so caching it would only
    // fail the first publish.
    mockGetCredentials.mockResolvedValueOnce(
      okResponse(new Date(Date.now() + 30_000).toISOString()),
    );

    const mod = await freshModule();
    await expect(mod.getCredentials()).rejects.toThrow(
      "IoT credentials already expired or expiring too soon.",
    );

    mockGetCredentials.mockResolvedValue(okResponse(new Date(Date.now() + 3600_000).toISOString()));
    const creds = await mod.getCredentials();
    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
  });

  it("evicts the cache on failure so the next caller can retry cleanly", async () => {
    mockGetCredentials.mockRejectedValueOnce(new Error("network down"));

    const mod = await freshModule();
    await expect(mod.getCredentials()).rejects.toThrow("network down");

    mockGetCredentials.mockResolvedValue(okResponse(new Date(Date.now() + 3600_000).toISOString()));
    const creds = await mod.getCredentials();
    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
  });
});

describe("createSignedUrl", () => {
  it("builds a SigV4-presigned wss URL including the session token", async () => {
    const mod = await freshModule();
    const url = await mod.createSignedUrl({
      clientId: "client-1",
      accessKeyId: "AKIA-EXAMPLE",
      secretAccessKey: "secret-example",
      sessionToken: "session-example",
      region: "eu-central-1",
      endpoint: "iot.example.com",
    });

    expect(url).toMatch(/^wss:\/\/iot\.example\.com\/mqtt\?/);
    expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).toContain("X-Amz-Security-Token=session-example");
  });
});
