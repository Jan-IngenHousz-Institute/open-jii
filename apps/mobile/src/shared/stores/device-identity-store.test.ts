import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDeviceIdentity,
  getLocalThingName,
  useDeviceIdentityStore,
  whenDeviceIdentityLoaded,
} from "./device-identity-store";

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvName: () => currentEnv,
}));

let currentEnv = "dev";

beforeEach(() => {
  currentEnv = "dev";
  useDeviceIdentityStore.setState({ identities: {}, isLoaded: true });
});

describe("device identity store", () => {
  it("mints one install id lazily and keeps it stable", () => {
    const first = getDeviceIdentity();
    const second = getDeviceIdentity();

    expect(first.installId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.installId).toBe(first.installId);
  });

  it("keys identities by environment, a dev registration means nothing in prod", () => {
    const dev = getDeviceIdentity();
    currentEnv = "prod";
    const prod = getDeviceIdentity();

    expect(prod.installId).not.toBe(dev.installId);
  });

  it("derives the thing name locally and prefers the server-assigned one", () => {
    const identity = getDeviceIdentity();
    expect(getLocalThingName()).toBe(`mobile_${identity.installId}`);

    useDeviceIdentityStore
      .getState()
      .setRegistered("dev", { thingName: `mobile_${identity.installId}`, deviceId: "dev-row-1" });

    expect(getLocalThingName()).toBe(`mobile_${identity.installId}`);
    expect(useDeviceIdentityStore.getState().identities.dev.deviceId).toBe("dev-row-1");
    expect(useDeviceIdentityStore.getState().identities.dev.registeredAt).toBeDefined();
  });

  it("refuses to hand out an identity before rehydration", () => {
    useDeviceIdentityStore.setState({ isLoaded: false });

    expect(() => getDeviceIdentity()).toThrow(/rehydration/);
  });

  it("opens the gate even when rehydration fails, starting empty", async () => {
    useDeviceIdentityStore.setState({ isLoaded: false });
    vi.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("storage unreadable"));

    await useDeviceIdentityStore.persist.rehydrate();

    // Refusing to load would brick publishing; unreadable storage is empty.
    expect(useDeviceIdentityStore.getState().isLoaded).toBe(true);
  });

  it("resolves the load gate immediately once rehydrated", async () => {
    await expect(whenDeviceIdentityLoaded()).resolves.toBeUndefined();
  });

  it("holds the load gate until rehydration finishes, without minting", async () => {
    useDeviceIdentityStore.setState({ isLoaded: false });

    let settled = false;
    const gate = whenDeviceIdentityLoaded().then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    await useDeviceIdentityStore.persist.rehydrate();
    await gate;
    expect(settled).toBe(true);
  });
});
