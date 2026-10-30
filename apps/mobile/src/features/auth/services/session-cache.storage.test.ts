import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { clearLocalCredentials, readCachedSession } from "./session-cache";

const { storage } = vi.hoisted(() => ({ storage: new Map<string, string>() }));
vi.mock("expo-secure-store", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { scheme: "openjii" } } }));
vi.mock("expo-linking", () => ({ createURL: (path: string) => `openjii://${path}` }));
vi.mock("expo-web-browser", () => ({}));

afterEach(() => storage.clear());

interface Storage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

// The chunk format belongs to Better Auth's Expo client, so the wipe is checked against what its
// storage adapter writes rather than against a copy of the format.
async function betterAuthStorage() {
  const fromAuth = createRequire(
    resolve(__dirname, "../../../../../../packages/auth/package.json"),
  );
  const { storageAdapter } = (await import(fromAuth.resolve("@better-auth/expo/client"))) as {
    storageAdapter: (storage: Storage) => {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => Promise<void>;
    };
  };
  return storageAdapter({
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
}

it("reads and wipes the chunked credentials Better Auth stores", async () => {
  const adapter = await betterAuthStorage();
  const session = {
    user: { id: "guest-a", name: "Visitor", isAnonymous: true, bio: "x".repeat(4_000) },
    session: { expiresAt: "2099-01-01T00:00:00.000Z" },
  };
  await adapter.setItem("openjii_session_data", JSON.stringify(session));
  await adapter.setItem("openjii_cookie", JSON.stringify({ token: "c".repeat(2_500) }));

  const chunks = [...storage.keys()].filter((key) => /\.\d+$/.test(key));
  expect(chunks.filter((key) => key.startsWith("openjii_session_data.")).length).toBeGreaterThan(1);
  expect(chunks.filter((key) => key.startsWith("openjii_cookie.")).length).toBeGreaterThan(1);
  expect(readCachedSession()?.user.id).toBe("guest-a");

  clearLocalCredentials("guest-a");
  for (const key of chunks) expect(storage.get(key)).toBe("");
  expect(adapter.getItem("openjii_session_data")).toBe("{}");
  expect(adapter.getItem("openjii_cookie")).toBe("{}");
});
