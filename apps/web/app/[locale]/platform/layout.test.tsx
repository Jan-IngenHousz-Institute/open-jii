import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AppLayout from "./layout";

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({ auth: () => mockAuth() }));

vi.mock("@/components/navigation/navigation-breadcrumbs/navigation-breadcrumbs", () => ({
  Breadcrumbs: () => <nav aria-label="breadcrumbs">Breadcrumbs</nav>,
}));

vi.mock("@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper", () => ({
  NavigationSidebarWrapper: () => <aside aria-label="sidebar">Sidebar</aside>,
}));

vi.mock("@/components/navigation/navigation-topbar/navigation-topbar", () => ({
  NavigationTopbar: () => <header aria-label="topbar">Topbar</header>,
}));

describe("AppLayout", () => {
  const defaultProps = {
    children: <div>Page content</div>,
    params: Promise.resolve({ locale: "en-US" }),
  };

  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(createSession());
  });

  it("renders children inside the layout when authenticated", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Topbar")).toBeInTheDocument();
    expect(screen.getByText("Breadcrumbs")).toBeInTheDocument();
  });

  it("redirects to login when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=%2Fplatform%2Fexperiments");
  });

  it("redirects to registration when user is not registered", async () => {
    mockAuth.mockResolvedValue(
      createSession({
        user: {
          id: "1",
          name: "New",
          email: "a@b.com",
          registered: false,
          firstName: "New",
          lastName: "User",
        },
      }),
    );
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/en-US/register?callbackUrl=%2Fplatform%2Fexperiments",
    );
  });
});
