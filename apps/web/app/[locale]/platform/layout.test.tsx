import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";

import AppLayout from "./layout";

const { mockSidebarWrapper } = vi.hoisted(() => ({ mockSidebarWrapper: vi.fn() }));

vi.mock("@/components/navigation/navigation-sidebar-wrapper/navigation-sidebar-wrapper", () => ({
  NavigationSidebarWrapper: (props: unknown) => {
    mockSidebarWrapper(props);
    return <aside aria-label="sidebar">Sidebar</aside>;
  },
}));

vi.mock("@/components/navigation/site-header/site-header", () => ({
  SiteHeader: () => <header aria-label="site-header">Site header</header>,
}));

vi.mock("@/components/whats-new/whats-new-sheet", () => ({
  WhatsNewSheet: () => null,
}));

describe("AppLayout", () => {
  const defaultProps = {
    children: <div>Page content</div>,
    params: Promise.resolve({ locale: "en-US" }),
  };

  const mockRedirect = vi.mocked(redirect);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createSession());
  });

  it("renders children inside the layout when authenticated", async () => {
    render(await AppLayout(defaultProps));

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Site header")).toBeInTheDocument();
  });

  it("passes the session user to the sidebar for the footer account menu", async () => {
    render(await AppLayout(defaultProps));

    expect(mockSidebarWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: "user-1", email: "test@example.com" },
      }),
    );
  });

  it("redirects to login when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AppLayout(defaultProps)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=%2Fplatform%2Fexperiments");
  });

  it("redirects to registration when user is not registered", async () => {
    vi.mocked(auth).mockResolvedValue(
      createSession({
        user: {
          id: "1",
          name: "New",
          email: "a@b.com",
          registered: false,
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
