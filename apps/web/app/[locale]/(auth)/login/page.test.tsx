import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";

import LoginPage from "./page";

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: () => <nav aria-label="main navigation" />,
}));
vi.mock("~/components/auth/auth-hero-section", () => ({
  AuthHeroSection: () => <section aria-label="auth hero" />,
}));
vi.mock("~/components/auth/login-form", () => ({
  LoginForm: ({ callbackUrl }: { callbackUrl?: string }) => (
    <form aria-label="login">{callbackUrl && <span>callback:{callbackUrl}</span>}</form>
  ),
}));
vi.mock("~/components/auth/terms-and-conditions-dialog", () => ({
  TermsAndConditionsDialog: () => Promise.resolve({ terms: [] }),
}));
vi.mock("@repo/ui/components/toaster", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null);
  });

  const renderPage = async (searchParams = {}) => {
    const ui = await LoginPage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve(searchParams),
    });
    return render(ui);
  };

  it("renders navbar, login form, hero section, and background image", async () => {
    await renderPage();
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /auth hero/i })).toBeInTheDocument();
    expect(screen.getByAltText(/login background/i)).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("forwards callbackUrl to the login form", async () => {
    await renderPage({ callbackUrl: "/platform" });
    expect(screen.getByText("callback:/platform")).toBeInTheDocument();
  });

  // 100vh is taller than the visible viewport once mobile browser chrome is up,
  // and a fixed height there is what forced the page to scroll at 390px.
  it("sizes the foreground to the small viewport and keeps mobile gutters", async () => {
    const { container } = await renderPage();

    const viewport = container.querySelector(".relative.z-10");
    expect(viewport?.className).toContain("min-h-[calc(100svh-4rem)]");
    expect(viewport?.className).not.toMatch(/\bh-\[calc\(100vh/);
    expect(viewport?.className).toContain("px-4");
  });

  it("renders with an authenticated session", async () => {
    vi.mocked(auth).mockResolvedValue(createSession());
    await renderPage();
    expect(screen.getByRole("form", { name: /login/i })).toBeInTheDocument();
  });
});
