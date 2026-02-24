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
  RegistrationForm: ({
    callbackUrl,
    termsData,
    emailOnly,
  }: {
    callbackUrl?: string;
    termsData: unknown;
    emailOnly?: boolean;
  }) => (
    <div data-testid="registration-form" data-email-only={String(emailOnly)}>
      Registration form - {callbackUrl ?? "no callback"} - {termsData ? "with terms" : "no terms"}
    </div>
  ),
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

  it("redirects to platform if user already registered", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "123", registered: true, email: "user@example.com" },
    });

    try {
      await UserRegistrationPage(defaultProps);
    } catch {
      // Expected to throw NEXT_REDIRECT
    }

    expect(mockRedirect).toHaveBeenCalledWith(`/${locale}/platform`);
  });

  it("does not redirect to platform when user is registered but has no valid email", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "123", registered: true, emailVerified: true, email: null },
    });

    render(await UserRegistrationPage(defaultProps));

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByTestId("registration-form")).toBeInTheDocument();
  });

  it("passes emailOnly=true to RegistrationForm when user is registered but has no valid email", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "123", registered: true, emailVerified: true, email: null },
    });

    render(await UserRegistrationPage(defaultProps));

    expect(screen.getByTestId("registration-form")).toHaveAttribute("data-email-only", "true");
  });

  it("renders with session for unregistered user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", registered: false } });

    render(await UserRegistrationPage(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("renders background image using Next.js Image component", async () => {
    const mockMathRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(await UserRegistrationPage(defaultProps));

    // Check for fixed background container
    const backgroundContainer = document.querySelector(".fixed.inset-0.z-0");
    expect(backgroundContainer).toBeInTheDocument();

    const image = document.querySelector('img[alt="Registration background"]');
    expect(image).toBeInTheDocument();

    const gradient = document.querySelector(".bg-gradient-to-l");
    expect(gradient).toBeInTheDocument();
    expect(gradient).toHaveClass("from-black", "via-black/80", "to-black/40");

    // Check for foreground content container
    const foregroundContainer = document.querySelector(".relative.z-10");
    expect(foregroundContainer).toBeInTheDocument();
    expect(foregroundContainer).toHaveClass("flex", "h-[calc(100vh-4rem)]");

    mockMathRandom.mockRestore();
  });

  it("renders with proper grid layout", async () => {
    render(await UserRegistrationPage(defaultProps));

    const gridContainer = document.querySelector(".grid.h-full");
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });
});
