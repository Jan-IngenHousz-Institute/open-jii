import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmRegistered,
  requestRegistrationEmailCode,
  saveProfile,
  subscribeToNewsletter,
  verifyRegistrationEmailCode,
} from "~/features/auth/api/registration.api";

const {
  createUserProfile,
  subscribeDirect,
  reloadSessionFromServer,
  requestEmailChange,
  changeEmail,
} = vi.hoisted(() => ({
  createUserProfile: vi.fn(),
  subscribeDirect: vi.fn(),
  reloadSessionFromServer: vi.fn(),
  requestEmailChange: vi.fn(),
  changeEmail: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpcClient: { users: { createUserProfile }, newsletter: { subscribeDirect } },
}));
vi.mock("~/features/auth/services/auth", () => ({
  reloadSessionFromServer,
  getAuthClient: () => ({ emailOtp: { requestEmailChange, changeEmail } }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  createUserProfile.mockResolvedValue({});
  reloadSessionFromServer.mockResolvedValue({ registered: true });
});

it("requests and verifies a registration code on the signed-in account", async () => {
  const email = "ada@example.com";
  requestEmailChange.mockResolvedValue({ data: { success: true } });
  changeEmail.mockResolvedValue({ data: { success: true } });

  await requestRegistrationEmailCode(email);
  await verifyRegistrationEmailCode(email, "123456");

  expect(requestEmailChange).toHaveBeenCalledExactlyOnceWith({
    newEmail: email,
    fetchOptions: { timeout: 8000 },
  });
  expect(changeEmail).toHaveBeenCalledExactlyOnceWith({
    newEmail: email,
    otp: "123456",
    fetchOptions: { timeout: 8000 },
  });
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
