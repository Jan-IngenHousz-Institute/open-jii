import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { auth } from "~/app/actions/auth";

import AccountPage from "./page";

vi.mock("~/components/account-settings/account-settings", () => ({
  AccountSettings: ({ session }: { session: unknown }) => (
    <div data-testid="account-settings">
      Account Settings - {session ? "with session" : "no session"}
    </div>
  ),
}));

describe("AccountPage", () => {
  it("renders with session", async () => {
    vi.mocked(auth).mockResolvedValue(createSession({ user: { id: "1", name: "User" } }));

    render(await AccountPage());

    expect(screen.getByText(/with session/)).toBeInTheDocument();
  });

  it("renders without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    render(await AccountPage());

    expect(screen.getByText(/no session/)).toBeInTheDocument();
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
