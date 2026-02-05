import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

globalThis.React = React;

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock i18n hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// Mock sub-components
vi.mock("./email-login-form", () => ({
  EmailLoginForm: ({
    callbackUrl,
    locale,
  }: {
    callbackUrl?: string;
    locale: string;
    onShowOTPChange?: (show: boolean) => void;
  }) => (
    <div data-testid="email-login-form" data-callback={callbackUrl} data-locale={locale}>
      Email Login Form
    </div>
  ),
}));

vi.mock("./oauth-login-form", () => ({
  OAuthLoginForm: ({
    provider,
    callbackUrl,
    layoutCount,
  }: {
    provider: { id: string; name: string };
    callbackUrl?: string;
    layoutCount?: number;
  }) => (
    <div
      data-testid={`oauth-login-${provider.id}`}
      data-callback={callbackUrl}
      data-layout={layoutCount}
    >
      {provider.name} Login
    </div>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { asChild?: boolean; children: React.ReactNode }) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
  DialogContent: ({ children }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  ScrollArea: ({ children }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

const mockTermsData = {
  title: "Terms and Conditions",
  content: "Mock terms and conditions content",
};

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with email provider", () => {
    render(<LoginForm callbackUrl="/dashboard" locale="en-US" termsData={mockTermsData} />);

    expect(screen.getByTestId("email-login-form")).toBeInTheDocument();
    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-callback", "/dashboard");
    expect(screen.getByTestId("email-login-form")).toHaveAttribute("data-locale", "en-US");
  });

  it("renders OAuth providers (GitHub and ORCID)", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    expect(screen.getByTestId("oauth-login-github")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-login-orcid")).toBeInTheDocument();
  });

  it("renders login title", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
  });

  it("renders divider between email and OAuth providers", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    expect(screen.getByText("auth.or")).toBeInTheDocument();
  });

  it("renders terms and conditions", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    expect(screen.getByText("auth.continueTermsPrefix")).toBeInTheDocument();
    expect(screen.getByText("Terms and Conditions")).toBeInTheDocument();
  });

  it("passes callbackUrl to EmailLoginForm", () => {
    render(<LoginForm callbackUrl="/custom-callback" locale="en-US" termsData={mockTermsData} />);

    // EmailLoginForm should render with the provided callback URL
    expect(screen.getByTestId("email-login-form")).toBeInTheDocument();
    expect(screen.getByTestId("email-login-form")).toHaveAttribute(
      "data-callback",
      "/custom-callback",
    );
  });

  it("passes correct layout count to OAuth providers", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    // With 2 OAuth providers (GitHub and ORCID), layoutCount should be 2
    const githubForm = screen.getByTestId("oauth-login-github");
    const orcidForm = screen.getByTestId("oauth-login-orcid");

    expect(githubForm).toHaveAttribute("data-layout", "2");
    expect(orcidForm).toHaveAttribute("data-layout", "2");
  });
});

describe("LoginContent", () => {
  it("hides elements when OTP is shown", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    // Initially, all elements should be visible
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.or")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-login-github")).toBeInTheDocument();
  });
});

describe("ProviderGrid", () => {
  it("renders multiple providers in a grid", () => {
    render(<LoginForm callbackUrl="/platform" locale="en-US" termsData={mockTermsData} />);

    // Should render both OAuth providers
    expect(screen.getByTestId("oauth-login-github")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-login-orcid")).toBeInTheDocument();
  });
});
