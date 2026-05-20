import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

class MockGetIdCommand {
  constructor(public readonly input: { IdentityPoolId: string }) {}
}
class MockGetCredentialsForIdentityCommand {
  constructor(public readonly input: { IdentityId: string }) {}
}

const mockSend = vi.fn();
class MockCognitoIdentityClient {
  send = mockSend;
}
vi.mock("@aws-sdk/client-cognito-identity", () => ({
  CognitoIdentityClient: MockCognitoIdentityClient,
  GetIdCommand: MockGetIdCommand,
  GetCredentialsForIdentityCommand: MockGetCredentialsForIdentityCommand,
}));

// Stub out the rest of the module's heavy/native imports.
vi.mock("paho-mqtt", () => ({ Client: vi.fn(), Message: vi.fn() }));
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: () => "stub" }));
vi.mock("~/shared/utils/time-sync", () => ({
  ensureSynced: vi.fn(),
  getSyncedUtcDateTime: vi.fn(),
  getTimeSyncState: vi.fn(),
}));
vi.mock("~/shared/utils/emitter", () => ({ Emitter: vi.fn() }));
vi.mock("~/shared/utils/generate-random-string", () => ({ generateRandomString: () => "rand" }));
vi.mock("crypto-js", () => ({
  HmacSHA256: () => ({ toString: () => "h" }),
  SHA256: () => ({ toString: () => "s" }),
  enc: { Hex: {} },
  lib: { WordArray: class {} },
}));

const POOL = "eu-central-1:test-pool";
const REGION = "eu-central-1";

const validCreds = (expiration: Date) => ({
  AccessKeyId: "AKIA-EXAMPLE",
  SecretKey: "secret-example",
  SessionToken: "session-example",
  Expiration: expiration,
});

interface Mod {
  getCredentials: (args: { region: string; identityPoolId: string }) => Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }>;
  _resetIdentityIdCacheForTests: () => void;
  _resetCredentialsCacheForTests: () => void;
}

async function freshModule(): Promise<Mod> {
  return (await import("../create-mqtt-connection")) as unknown as Mod;
}

describe("getCredentials — Cognito IdentityId persistence", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    const mod = await freshModule();
    mod._resetIdentityIdCacheForTests();
    mod._resetCredentialsCacheForTests();
  });

  it("calls GetIdCommand once and persists the IdentityId to AsyncStorage on first fetch", async () => {
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return Promise.resolve({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
    });

    const mod = await freshModule();
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    const getIdCalls = mockSend.mock.calls.filter((c) => c[0] instanceof MockGetIdCommand);
    expect(getIdCalls).toHaveLength(1);
    expect(mockSetItem).toHaveBeenCalledWith(`cognito_identity_id:${POOL}`, "id-1");
  });

  it("reuses the persisted IdentityId on a fresh process (AsyncStorage hit) — no GetId call", async () => {
    mockGetItem.mockResolvedValueOnce("persisted-id");
    mockSend.mockResolvedValue({
      Credentials: validCreds(new Date(Date.now() + 3600_000)),
    });

    const mod = await freshModule();
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    const getIdCalls = mockSend.mock.calls.filter((c) => c[0] instanceof MockGetIdCommand);
    expect(getIdCalls).toHaveLength(0);

    const credCalls = mockSend.mock.calls.filter(
      (c) => c[0] instanceof MockGetCredentialsForIdentityCommand,
    );
    expect(credCalls[0][0].input.IdentityId).toBe("persisted-id");
  });

  it("clears the cached IdentityId and re-fetches when ResourceNotFoundException is raised", async () => {
    mockGetItem.mockResolvedValueOnce("stale-id");

    const stale = Object.assign(new Error("not found"), { name: "ResourceNotFoundException" });
    let getCredsCalls = 0;
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "fresh-id" });
      if (cmd instanceof MockGetCredentialsForIdentityCommand) {
        getCredsCalls += 1;
        if (getCredsCalls === 1) return Promise.reject(stale);
        return Promise.resolve({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
      }
      return Promise.reject(new Error("unexpected"));
    });

    const mod = await freshModule();
    const creds = await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
    expect(mockRemoveItem).toHaveBeenCalledWith(`cognito_identity_id:${POOL}`);
    const getIdCalls = mockSend.mock.calls.filter((c) => c[0] instanceof MockGetIdCommand);
    expect(getIdCalls).toHaveLength(1); // refresh after eviction
  });

  it("still caches in memory if AsyncStorage.setItem throws when persisting a new IdentityId", async () => {
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "minted" });
      return Promise.resolve({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
    });
    mockSetItem.mockRejectedValueOnce(new Error("disk full"));
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    const mod = await freshModule();
    const creds = await mod.getCredentials({ region: REGION, identityPoolId: POOL });
    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to persist Cognito IdentityId"),
    );

    // Second call within the same process uses the in-memory cache — no extra GetId.
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });
    const getIdCalls = mockSend.mock.calls.filter((c) => c[0] instanceof MockGetIdCommand);
    expect(getIdCalls).toHaveLength(1);

    consoleSpy.mockRestore();
  });

  it("continues when AsyncStorage.removeItem throws while clearing a stale IdentityId", async () => {
    mockGetItem.mockResolvedValueOnce("stale-id");
    mockRemoveItem.mockRejectedValueOnce(new Error("disk error"));

    const stale = Object.assign(new Error("not found"), { name: "ResourceNotFoundException" });
    let getCredsCalls = 0;
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "fresh-id" });
      if (cmd instanceof MockGetCredentialsForIdentityCommand) {
        getCredsCalls += 1;
        if (getCredsCalls === 1) return Promise.reject(stale);
        return Promise.resolve({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
      }
      return Promise.reject(new Error("unexpected"));
    });
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

    const mod = await freshModule();
    const creds = await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to clear persisted Cognito IdentityId"),
    );

    consoleSpy.mockRestore();
  });

  it("collapses concurrent first-time callers into one GetId + one GetCredentials", async () => {
    let resolveCreds: (v: unknown) => void = () => undefined;
    const credsPromise = new Promise((r) => {
      resolveCreds = r;
    });
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return credsPromise;
    });

    const mod = await freshModule();
    const a = mod.getCredentials({ region: REGION, identityPoolId: POOL });
    const b = mod.getCredentials({ region: REGION, identityPoolId: POOL });
    const c = mod.getCredentials({ region: REGION, identityPoolId: POOL });

    resolveCreds({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
    await Promise.all([a, b, c]);

    const getIdCalls = mockSend.mock.calls.filter((c) => c[0] instanceof MockGetIdCommand);
    const credCalls = mockSend.mock.calls.filter(
      (c) => c[0] instanceof MockGetCredentialsForIdentityCommand,
    );
    expect(getIdCalls).toHaveLength(1);
    expect(credCalls).toHaveLength(1);
  });
});

describe("getCredentials — in-memory credential cache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetItem.mockResolvedValue("id-1"); // simulate IdentityId already persisted
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    const mod = await freshModule();
    mod._resetIdentityIdCacheForTests();
    mod._resetCredentialsCacheForTests();
  });

  it("returns cached credentials on a second call without hitting Cognito", async () => {
    mockSend.mockResolvedValue({
      Credentials: validCreds(new Date(Date.now() + 3600_000)),
    });

    const mod = await freshModule();
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });
    const sendCallsAfterFirst = mockSend.mock.calls.length;

    await mod.getCredentials({ region: REGION, identityPoolId: POOL });
    expect(mockSend.mock.calls.length).toBe(sendCallsAfterFirst); // no additional SDK calls
  });

  it("re-fetches credentials once the SDK-reported Expiration has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));

    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return Promise.resolve({
        // 30 minutes from "now"
        Credentials: validCreds(new Date(Date.now() + 30 * 60_000)),
      });
    });

    const mod = await freshModule();
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    // Jump past expiration
    vi.setSystemTime(new Date("2026-05-13T12:31:00Z"));
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    const credCalls = mockSend.mock.calls.filter(
      (c) => c[0] instanceof MockGetCredentialsForIdentityCommand,
    );
    expect(credCalls).toHaveLength(2);
  });

  it("re-fetches credentials when within the safety margin of expiration (under 60s remaining)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));

    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return Promise.resolve({
        Credentials: validCreds(new Date(Date.now() + 60 * 60_000)),
      });
    });

    const mod = await freshModule();
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    // 30 seconds before expiration — within the 60s safety margin
    vi.setSystemTime(new Date("2026-05-13T12:59:30Z"));
    await mod.getCredentials({ region: REGION, identityPoolId: POOL });

    const credCalls = mockSend.mock.calls.filter(
      (c) => c[0] instanceof MockGetCredentialsForIdentityCommand,
    );
    expect(credCalls).toHaveLength(2);
  });

  it("collapses concurrent in-flight credential fetches into one SDK call", async () => {
    let resolveCreds: (v: unknown) => void = () => undefined;
    const credsPromise = new Promise((r) => {
      resolveCreds = r;
    });
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return credsPromise;
    });

    const mod = await freshModule();
    const promises = [
      mod.getCredentials({ region: REGION, identityPoolId: POOL }),
      mod.getCredentials({ region: REGION, identityPoolId: POOL }),
      mod.getCredentials({ region: REGION, identityPoolId: POOL }),
    ];

    resolveCreds({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    const credCalls = mockSend.mock.calls.filter(
      (c) => c[0] instanceof MockGetCredentialsForIdentityCommand,
    );
    expect(credCalls).toHaveLength(1);
  });

  it("evicts the cache on failure so the next caller can retry cleanly", async () => {
    mockSend.mockImplementationOnce((cmd: object) => {
      if (cmd instanceof MockGetCredentialsForIdentityCommand) {
        return Promise.reject(new Error("network down"));
      }
      return Promise.resolve({});
    });

    const mod = await freshModule();
    await expect(mod.getCredentials({ region: REGION, identityPoolId: POOL })).rejects.toThrow(
      "network down",
    );

    // Subsequent call should retry the SDK rather than returning a poisoned cache.
    mockSend.mockImplementation((cmd: object) => {
      if (cmd instanceof MockGetIdCommand) return Promise.resolve({ IdentityId: "id-1" });
      return Promise.resolve({ Credentials: validCreds(new Date(Date.now() + 3600_000)) });
    });
    const creds = await mod.getCredentials({ region: REGION, identityPoolId: POOL });
    expect(creds.accessKeyId).toBe("AKIA-EXAMPLE");
  });
});
