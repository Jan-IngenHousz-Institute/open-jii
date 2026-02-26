import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { auth } from "~/app/actions/auth";

import AccountSettingsPage from "./page";

vi.mock("~/components/account-settings/account-settings", () => ({
  AccountSettings: ({ session }: { session: unknown }) => (
    <div data-testid="account-settings">
      Account Settings - {session ? "with session" : "no session"}
    </div>
  ),
}));

describe("AccountSettingsPage", () => {
  it("renders with session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "User" } });

    render(await AccountSettingsPage());

    expect(screen.getByText(/with session/)).toBeInTheDocument();
  });

  it("renders without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    render(await AccountSettingsPage());

    expect(screen.getByText(/no session/)).toBeInTheDocument();
  });

  it("calls auth to get session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    await AccountSettingsPage();

    expect(auth).toHaveBeenCalledTimes(1);
  });

  it("handles auth error", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("Auth failed"));

    await expect(AccountSettingsPage()).rejects.toThrow("Auth failed");
  });
});
