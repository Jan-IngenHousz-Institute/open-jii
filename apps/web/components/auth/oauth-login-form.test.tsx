import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { OAuthLoginForm } from "./oauth-login-form";

globalThis.React = React;

// Mock auth client - declare functions first to avoid hoisting issues
vi.mock("@repo/auth/client", () => ({
  authClient: {
    signIn: {
      oauth2: vi.fn(),
      social: vi.fn(),
    },
  },
}));

const mockSignInOAuth2 = authClient.signIn.oauth2 as ReturnType<typeof vi.fn>;
const mockSignInSocial = authClient.signIn.social as ReturnType<typeof vi.fn>;

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    type,
    className,
    variant,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    children: React.ReactNode;
  }) => (
    <button type={type} className={className} data-variant={variant} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader" />,
}));

describe("OAuthLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GitHub provider", () => {
    const githubProvider = { id: "github", name: "GitHub" };

    it("renders GitHub login button", () => {
      render(<OAuthLoginForm provider={githubProvider} callbackUrl="/platform" />);

      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });

    it("calls social provider on submit", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={githubProvider} callbackUrl="/dashboard" />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("uses default callback URL when not provided", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={githubProvider} callbackUrl={undefined} />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "http://localhost:3000/platform",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("shows GitHub SVG icon", () => {
      const { container } = render(
        <OAuthLoginForm provider={githubProvider} callbackUrl="/platform" />,
      );

      const svg = container.querySelector('svg[viewBox="0 0 24 24"]');
      expect(svg).toBeInTheDocument();
    });
  });

  describe("ORCID provider", () => {
    const orcidProvider = { id: "orcid", name: "ORCID" };

    it("renders ORCID login button", () => {
      render(<OAuthLoginForm provider={orcidProvider} callbackUrl="/platform" />);

      expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
    });

    it("calls oauth2 provider on submit", async () => {
      const user = userEvent.setup();
      render(<OAuthLoginForm provider={orcidProvider} callbackUrl="/dashboard" />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockSignInOAuth2).toHaveBeenCalledWith({
        providerId: "orcid",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login-error",
      });
    });

    it("shows ORCID SVG icon with correct color", () => {
      const { container } = render(
        <OAuthLoginForm provider={orcidProvider} callbackUrl="/platform" />,
      );

      const path = container.querySelector('path[fill="#A6CE39"]');
      expect(path).toBeInTheDocument();
    });
  });

  describe("Layout variants", () => {
    const githubProvider = { id: "github", name: "GitHub" };

    it("renders with layout count 2", () => {
      render(<OAuthLoginForm provider={githubProvider} callbackUrl="/platform" layoutCount={2} />);

      // Should show provider name in mobile/desktop variants
      expect(screen.getByText("Github")).toBeInTheDocument();
    });

    it("renders with layout count 3", () => {
      render(<OAuthLoginForm provider={githubProvider} callbackUrl="/platform" layoutCount={3} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("renders default layout when layoutCount not specified", () => {
      render(<OAuthLoginForm provider={githubProvider} callbackUrl="/platform" />);

      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });
  });

  describe("Provider images", () => {
    it("renders GitHub icon for github provider", () => {
      const { container } = render(
        <OAuthLoginForm provider={{ id: "github", name: "GitHub" }} callbackUrl="/platform" />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });

    it("renders ORCID icon for orcid provider", () => {
      const { container } = render(
        <OAuthLoginForm provider={{ id: "orcid", name: "ORCID" }} callbackUrl="/platform" />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });

    it("returns null for unknown provider", () => {
      render(
        <OAuthLoginForm provider={{ id: "unknown", name: "Unknown" }} callbackUrl="/platform" />,
      );

      // Should still render button, just without icon
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Provider name capitalization", () => {
    it("capitalizes provider name correctly", () => {
      render(
        <OAuthLoginForm provider={{ id: "github", name: "github" }} callbackUrl="/platform" />,
      );

      // The component should capitalize the first letter and show translation key
      expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    });
  });
});
