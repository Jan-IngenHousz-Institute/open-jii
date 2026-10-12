import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { auth } from "~/app/actions/auth";

import AccountPage from "./page";

vi.mock("~/components/account-settings/account-settings", () => ({
  AccountSettings: ({ user }: { user: unknown }) => (
    <div data-testid="account-settings">Account Settings - {user ? "with user" : "no user"}</div>
  ),
}));

describe("AccountPage", () => {
  it("renders with session", async () => {
    vi.mocked(auth).mockResolvedValue(createSession({ user: { id: "1", name: "User" } }));

    render(await AccountPage());

    expect(screen.getByText(/with user/)).toBeInTheDocument();
  });

  it("passes only the user, so the session token stays out of the page", async () => {
    const session = createSession({ user: { id: "1", name: "User" } });
    vi.mocked(auth).mockResolvedValue(session);

    const page = await AccountPage();

    expect(page.props).toEqual({ user: session.user });
  });

  it("renders without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    render(await AccountPage());

    expect(screen.getByText(/no user/)).toBeInTheDocument();
  });

  it("calls auth to get session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    await AccountPage();

    expect(auth).toHaveBeenCalledTimes(1);
  });

  it("handles auth error", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("Auth failed"));

    await expect(AccountPage()).rejects.toThrow("Auth failed");
  });
});
