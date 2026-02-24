import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "~/env";

import { SidebarProvider } from "@repo/ui/components";

import { NavUser } from "./nav-user";

// Hoisted mocks
const { mockSignOutMutateAsync, mockPush, useGetUserProfileMock } = vi.hoisted(() => ({
  mockSignOutMutateAsync: vi.fn(),
  mockPush: vi.fn(),
  useGetUserProfileMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("~/hooks/auth", () => ({
  useSignOut: () => ({ mutateAsync: mockSignOutMutateAsync, isPending: false }),
}));

vi.mock("@/lib/tsr", () => ({
  tsr: {
    users: {
      getUserProfile: {
        useQuery: (config: { queryData: { params: { id: string } } }) =>
          useGetUserProfileMock(config.queryData.params.id),
      },
    },
  },
}));

const baseUser = { id: "u-1", email: "ada@example.com", avatar: "https://example.com/a.png" };

function renderNav(
  opts: {
    profile?: { firstName?: string; lastName?: string };
    locale?: string;
    compact?: boolean;
  } = {},
) {
  useGetUserProfileMock.mockReturnValue({
    data: { body: opts.profile ?? undefined },
  });
  return render(
    <SidebarProvider>
      <NavUser user={baseUser} locale={opts.locale ?? "en-US"} compact={opts.compact} />
    </SidebarProvider>,
  );
}

describe("NavUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders avatar button with user name", () => {
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" } });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("renders without profile (empty fallback)", () => {
    renderNav();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders dropdown with account, support, faq, logout", async () => {
    const user = userEvent.setup();
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" } });
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
    const user = userEvent.setup();
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" } });
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("menuitem", { name: "navigation.logout" }));
    expect(mockSignOutMutateAsync).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("uses docs URL from environment for support link", async () => {
    env.NEXT_PUBLIC_DOCS_URL = "https://docs.openjii.org";
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("menuitem", { name: "navigation.support" })).toHaveAttribute(
      "href",
      "https://docs.openjii.org",
    );
  });

  it("shows menu when dropdown is opened (compact mode)", async () => {
    const user = userEvent.setup();
    renderNav({ profile: { firstName: "Ada", lastName: "Lovelace" } });
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("renders in non-compact (sidebar) mode", () => {
    renderNav({
      profile: { firstName: "Ada", lastName: "Lovelace" },
      compact: false,
    });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
