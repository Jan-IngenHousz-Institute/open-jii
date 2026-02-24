import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import RegisterPage from "./page";

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({ auth: () => mockAuth(), providerMap: [] }));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: () => <nav aria-label="main navigation" />,
}));
vi.mock("~/components/auth/auth-hero-section", () => ({
  AuthHeroSection: () => <section aria-label="auth hero" />,
}));
vi.mock("~/components/auth/registration-form", () => ({
  RegistrationForm: () => <form aria-label="registration" />,
}));
vi.mock("~/components/auth/terms-and-conditions-dialog", () => ({
  TermsAndConditionsDialog: () => Promise.resolve({ terms: [] }),
}));

describe("RegisterPage", () => {
  const props = {
    params: Promise.resolve({ locale: "en-US" }),
    searchParams: Promise.resolve({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(
      createSession({
        user: {
          id: "1",
          name: "Test",
          email: "t@t.com",
          registered: false,
          firstName: "Test",
          lastName: "User",
        },
      }),
    );
  });

  it("redirects to login when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await RegisterPage(props).catch(() => {});
    expect(redirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=/en-US/register");
  });

  it("redirects to platform when already registered", async () => {
    mockAuth.mockResolvedValue(createSession());
    await RegisterPage(props);
    expect(redirect).toHaveBeenCalledWith("/en-US/platform");
  });

  it("renders registration form for unregistered authenticated user", async () => {
    const ui = await RegisterPage(props);
    render(ui);
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /registration/i })).toBeInTheDocument();
    expect(screen.getByAltText(/registration background/i)).toBeInTheDocument();
  });
});
