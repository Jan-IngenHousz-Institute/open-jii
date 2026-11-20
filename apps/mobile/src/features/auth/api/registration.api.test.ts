import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeRegistration } from "~/features/auth/api/registration.api";

const { createUserProfile, getSession, notify } = vi.hoisted(() => ({
  createUserProfile: vi.fn(),
  getSession: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpcClient: { users: { createUserProfile }, newsletter: { subscribeDirect: vi.fn() } },
}));
vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({ getSession, $store: { notify } }),
}));

const profile = { firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

beforeEach(() => {
  createUserProfile.mockReset().mockResolvedValue({});
  getSession.mockReset().mockResolvedValue({ data: { user: { registered: true } }, error: null });
  notify.mockReset();
});

describe("completeRegistration", () => {
  it("saves the profile, then re-reads the session past its cookie cache", async () => {
    await completeRegistration(profile);

    expect(createUserProfile).toHaveBeenCalledWith(profile);
    expect(getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("does not refresh the session when the profile could not be saved", async () => {
    createUserProfile.mockRejectedValue(new Error("Bad Request"));

    await expect(completeRegistration(profile)).rejects.toThrow("Bad Request");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("fails rather than leaving the user on a session that still reads unregistered", async () => {
    getSession.mockResolvedValue({ data: { user: { registered: false } }, error: null });

    await expect(completeRegistration(profile)).rejects.toThrow();
    expect(notify).not.toHaveBeenCalled();
  });
});
