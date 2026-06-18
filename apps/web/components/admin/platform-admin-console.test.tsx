import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "~/test/test-utils";

import { authClient, useSession } from "@repo/auth/client";

import { PlatformAdminConsole } from "./platform-admin-console";

const listUsers = vi.mocked(authClient.admin.listUsers);
const setRole = vi.mocked(authClient.admin.setRole);
const banUser = vi.mocked(authClient.admin.banUser);

function setSessionRole(role: string | null, id = "u-admin") {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id, role } },
  } as unknown as ReturnType<typeof useSession>);
}

function setUsers(users: unknown[]) {
  listUsers.mockResolvedValue({
    data: { users, total: users.length },
    error: null,
  } as never);
}

const adminUser = {
  id: "u-admin",
  name: "Admin",
  email: "admin@x.com",
  role: "admin",
  banned: false,
};
const plainUser = { id: "u-bob", name: "Bob", email: "bob@x.com", role: null, banned: false };

describe("PlatformAdminConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access to non-admins", () => {
    setSessionRole(null, "u-bob");
    render(<PlatformAdminConsole />);
    expect(screen.getByText("You do not have platform admin access.")).toBeInTheDocument();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("lists users with controls for an admin (no self-actions)", async () => {
    setSessionRole("admin", "u-admin");
    setUsers([adminUser, plainUser]);

    render(<PlatformAdminConsole />);

    expect(await screen.findByText("bob@x.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Ban bob@x.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Impersonate bob@x.com")).toBeInTheDocument();
    // No actions on self.
    expect(screen.queryByLabelText("Ban admin@x.com")).not.toBeInTheDocument();
  });

  it("bans a user", async () => {
    setSessionRole("admin", "u-admin");
    setUsers([adminUser, plainUser]);

    render(<PlatformAdminConsole />);
    await userEvent.click(await screen.findByLabelText("Ban bob@x.com"));

    await waitFor(() => expect(banUser).toHaveBeenCalledWith({ userId: "u-bob" }));
  });

  it("promotes a user to admin", async () => {
    setSessionRole("admin", "u-admin");
    setUsers([adminUser, plainUser]);

    render(<PlatformAdminConsole />);
    await userEvent.selectOptions(await screen.findByLabelText("Role for bob@x.com"), "admin");

    await waitFor(() => expect(setRole).toHaveBeenCalledWith({ userId: "u-bob", role: "admin" }));
  });

  it("impersonates a user and unbans a banned user", async () => {
    const impersonateUser = vi.mocked(authClient.admin.impersonateUser);
    const unbanUser = vi.mocked(authClient.admin.unbanUser);
    setSessionRole("admin", "u-admin");
    setUsers([adminUser, { ...plainUser, banned: true }]);

    render(<PlatformAdminConsole />);

    await userEvent.click(await screen.findByLabelText("Impersonate bob@x.com"));
    await waitFor(() => expect(impersonateUser).toHaveBeenCalledWith({ userId: "u-bob" }));

    // A banned user shows Unban instead of Ban.
    await userEvent.click(screen.getByLabelText("Unban bob@x.com"));
    await waitFor(() => expect(unbanUser).toHaveBeenCalledWith({ userId: "u-bob" }));
  });
});
