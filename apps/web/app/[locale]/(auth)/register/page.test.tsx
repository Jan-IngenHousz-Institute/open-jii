import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";

import RegisterPage from "./page";

vi.mock("@/components/navigation/public-navbar", () => ({
  PublicNavbar: () => <nav aria-label="main navigation" />,
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
    vi.mocked(auth).mockResolvedValue(createSession({ user: { registered: false } }));
  });

  it("redirects to login when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    await RegisterPage(props).catch(() => undefined);
    expect(redirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=/en-US/register");
  });

  it("redirects to platform when already registered", async () => {
    vi.mocked(auth).mockResolvedValue(createSession());
    await RegisterPage(props);
    expect(redirect).toHaveBeenCalledWith("/en-US/platform");
  });

  it("sends a guest to the platform, since a guest cannot register a profile", async () => {
    vi.mocked(auth).mockResolvedValue(
      createSession({ user: { registered: false, isAnonymous: true } }),
    );
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
