import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmRegistered,
  saveProfile,
  subscribeToNewsletter,
} from "~/features/auth/api/registration.api";

const { createUserProfile, subscribeDirect, reloadSessionFromServer } = vi.hoisted(() => ({
  createUserProfile: vi.fn(),
  subscribeDirect: vi.fn(),
  reloadSessionFromServer: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpcClient: { users: { createUserProfile }, newsletter: { subscribeDirect } },
}));
vi.mock("~/features/auth/services/auth", () => ({ reloadSessionFromServer }));

beforeEach(() => {
  vi.resetAllMocks();
  createUserProfile.mockResolvedValue({});
  reloadSessionFromServer.mockResolvedValue({ registered: true });
});

describe("saveProfile", () => {
  it("saves the profile through the backend", async () => {
    const profile = { firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

    await saveProfile(profile);

    expect(createUserProfile).toHaveBeenCalledWith(profile);
  });
});

describe("confirmRegistered", () => {
  it("resolves once the reloaded session reads the account as registered", async () => {
    await expect(confirmRegistered()).resolves.toBeUndefined();
    expect(reloadSessionFromServer).toHaveBeenCalledTimes(1);
  });

  it("fails while the session still reads unregistered or could not be read", async () => {
    reloadSessionFromServer.mockResolvedValue({ registered: false });
    await expect(confirmRegistered()).rejects.toThrow();

    reloadSessionFromServer.mockResolvedValue(null);
    await expect(confirmRegistered()).rejects.toThrow();
  });
});

describe("subscribeToNewsletter", () => {
  it("subscribes the signed-in account directly", async () => {
    subscribeDirect.mockResolvedValue({ status: "subscribed" });

    await expect(subscribeToNewsletter()).resolves.toEqual({ status: "subscribed" });
    expect(subscribeDirect).toHaveBeenCalledTimes(1);
  });
});
