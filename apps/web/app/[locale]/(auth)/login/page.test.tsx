import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import LoginPage from "./page";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("~/app/actions/auth", () => ({ auth: mockAuth, providerMap: [] }));

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

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
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
  });

  it("forwards callbackUrl to the login form", async () => {
    await renderPage({ callbackUrl: "/platform" });
    expect(screen.getByText("callback:/platform")).toBeInTheDocument();
  });

  it("renders with an authenticated session", async () => {
    mockAuth.mockResolvedValue(createSession());
    await renderPage();
    expect(screen.getByRole("form", { name: /login/i })).toBeInTheDocument();
  });
});
