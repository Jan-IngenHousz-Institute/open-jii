import { beforeEach, expect, it, vi } from "vitest";

import { useAuthClient, getAuthClient, _resetAuthClientsForTests } from "./auth";
import { acceptNewSession, clearLocalCredentials } from "./session-cache";

const { storage, clients } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  clients: [] as {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  }[],
}));
vi.mock("expo-secure-store", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://backend.test",
  useEnvVar: () => "https://backend.test",
}));
vi.mock("@repo/auth/client.native", () => ({
  createOpenJiiAuthClient: (_url: string, store: (typeof clients)[number]) => {
    clients.push(store);
    return { storage: store };
  },
}));
beforeEach(() => {
  _resetAuthClientsForTests();
  storage.clear();
  clients.length = 0;
});
it("a late auth response cannot restore guest A credentials after leave or overwrite guest B", () => {
  const first = getAuthClient();
  clients[0].setItem("openjii_cookie", "guest-a-token");
  clearLocalCredentials("guest-a");
  expect(clients[0].getItem("openjii_cookie")).toBeNull();
  expect(getAuthClient()).not.toBe(first);
  clients[1].setItem("openjii_cookie", "guest-b-token");
  acceptNewSession("guest-b");
  clients[0].setItem("openjii_cookie", "guest-a-token");
  clients[0].setItem("openjii_session_data", "guest-a-data");
  expect(storage.get("openjii_cookie")).toBe("guest-b-token");
  expect(storage.get("openjii_session_data")).toBe("{}");
});

it("uses the same identity-scoped client for hook and imperative consumers", () => {
  expect(useAuthClient()).toBe(getAuthClient());
  expect(clients).toHaveLength(1);
});
