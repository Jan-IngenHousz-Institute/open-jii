import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeRegistration, subscribeToNewsletter } from "~/features/auth/api/registration.api";

const { createUserProfile, subscribeDirect, reloadSessionFromServer } = vi.hoisted(() => ({
  createUserProfile: vi.fn(),
  subscribeDirect: vi.fn(),
  reloadSessionFromServer: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpcClient: { users: { createUserProfile }, newsletter: { subscribeDirect } },
}));
vi.mock("~/features/auth/services/auth", () => ({ reloadSessionFromServer }));

const profile = { firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

beforeEach(() => {
  createUserProfile.mockReset().mockResolvedValue({});
  reloadSessionFromServer.mockReset().mockResolvedValue({ registered: true });
});

describe("completeRegistration", () => {
  it("saves the profile, then reloads the session from the server", async () => {
    await completeRegistration(profile);

    expect(createUserProfile).toHaveBeenCalledWith(profile);
    expect(reloadSessionFromServer).toHaveBeenCalledTimes(1);
  });

  it("does not reload the session when the profile could not be saved", async () => {
    createUserProfile.mockRejectedValue(new Error("Bad Request"));

    await expect(completeRegistration(profile)).rejects.toThrow("Bad Request");
    expect(reloadSessionFromServer).not.toHaveBeenCalled();
  });

  it("fails rather than reporting success while the session still reads unregistered", async () => {
    reloadSessionFromServer.mockResolvedValue({ registered: false });
    await expect(completeRegistration(profile)).rejects.toThrow();

    reloadSessionFromServer.mockResolvedValue(null);
    await expect(completeRegistration(profile)).rejects.toThrow();
  });
});

describe("subscribeToNewsletter", () => {
  it("subscribes the signed-in account directly", async () => {
    subscribeDirect.mockResolvedValue({ status: "subscribed" });

    await expect(subscribeToNewsletter()).resolves.toEqual({ status: "subscribed" });
    expect(subscribeDirect).toHaveBeenCalledTimes(1);
  });
});
