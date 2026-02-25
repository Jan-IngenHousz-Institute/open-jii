import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "~/env";

import { contract } from "@repo/api";
import { authClient } from "@repo/auth/client";
import { SidebarProvider } from "@repo/ui/components";

import { NavUser } from "./nav-user";

const baseUser = { id: "u-1", email: "ada@example.com", avatar: "https://example.com/a.png" };

/** Override the user profile MSW handler for a specific test. */
function useProfileOverride(profile: { firstName?: string; lastName?: string } | null) {
  if (profile === null) {
    server.mount(contract.users.getUserProfile, { status: 404 });
  } else {
    server.mount(contract.users.getUserProfile, {
      body: createUserProfile({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
      }),
    });
  }
}

function renderNav(opts: { locale?: string; compact?: boolean } = {}) {
  return render(
    <SidebarProvider>
      <NavUser user={baseUser} locale={opts.locale ?? "en-US"} compact={opts.compact} />
    </SidebarProvider>,
  );
}

describe("NavUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders avatar button with user name", async () => {
    useProfileOverride({ firstName: "Ada", lastName: "Lovelace" });
    renderNav();
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("renders without profile (empty fallback)", async () => {
    useProfileOverride(null);
    renderNav();
    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  it("renders dropdown with account, support, faq, logout", async () => {
    useProfileOverride({ firstName: "Ada", lastName: "Lovelace" });
    const user = userEvent.setup();
    renderNav();
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("menuitem", { name: "auth.account" })).toHaveAttribute(
      "href",
      "/en-US/platform/account/settings",
    );
    expect(screen.getByRole("menuitem", { name: "navigation.logout" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "navigation.support" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "navigation.faq" })).toHaveAttribute(
      "href",
      "/en-US/faq",
    );
  });

  it("calls signOut and navigates home on logout click", async () => {
    useProfileOverride({ firstName: "Ada", lastName: "Lovelace" });
    const user = userEvent.setup();
    const { router } = renderNav();
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("menuitem", { name: "navigation.logout" }));
    await waitFor(() => expect(authClient.signOut).toHaveBeenCalled());
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("uses docs URL from environment for support link", async () => {
    useProfileOverride({ firstName: "Test", lastName: "User" });
    env.NEXT_PUBLIC_DOCS_URL = "https://docs.openjii.org";
    const user = userEvent.setup();
    renderNav();
    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("menuitem", { name: "navigation.support" })).toHaveAttribute(
      "href",
      "https://docs.openjii.org",
    );
  });

  it("shows menu when dropdown is opened (compact mode)", async () => {
    useProfileOverride({ firstName: "Ada", lastName: "Lovelace" });
    const user = userEvent.setup();
    renderNav();
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("renders in non-compact (sidebar) mode", async () => {
    useProfileOverride({ firstName: "Ada", lastName: "Lovelace" });
    renderNav({ compact: false });
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
