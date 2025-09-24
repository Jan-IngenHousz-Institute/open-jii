import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import { LoginForm } from "./login-form";

globalThis.React = React;

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock auth module
vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  providerMap: [
    { id: "github", name: "GitHub" },
    { id: "nodemailer", name: "Email" },
    { id: "orcid", name: "ORCID" },
  ],
}));

// Mock AuthError
vi.mock("@repo/auth/next", () => ({
  AuthError: class AuthError extends Error {
    type: string;
    constructor(type: string) {
      super(type);
      this.type = type;
    }
  },
}));

// Mock initTranslations
vi.mock("@repo/i18n/server", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      t: (key: string) => key,
    }),
  ),
}));

// Mock TermsAndConditionsDialog
vi.mock("./terms-and-conditions-dialog", () => ({
  TermsAndConditionsDialog: vi.fn(() =>
    Promise.resolve({
      title: "Terms and Conditions",
      content: "Mock terms and conditions content",
    }),
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    type,
    className,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    children: React.ReactNode;
  }) => (
    <button type={type} className={className} data-variant={variant} {...props}>
      {children}
    </button>
  ),
  Input: ({
    id,
    name,
    type,
    placeholder,
    required,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      id={id}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      {...props}
    />
  ),
  Label: ({
    htmlFor,
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement> & {
    children: React.ReactNode;
  }) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="dialog-trigger">{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

describe("LoginForm", () => {
  const defaultProps = {
    callbackUrl: "/dashboard",
    locale: "en-US" as Locale,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with title and providers", async () => {
    render(await LoginForm(defaultProps));

    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
  });

  it("renders email input form for nodemailer provider", async () => {
    render(await LoginForm(defaultProps));

    const emailInput = screen.getByLabelText("auth.email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "m@example.com");
    expect(emailInput).toBeRequired();
    expect(emailInput).toHaveAttribute("name", "email");
    expect(emailInput).toHaveAttribute("id", "email");
  });

  it("renders provider icons correctly", async () => {
    render(await LoginForm(defaultProps));

    // Check for GitHub SVG
    const githubSvg = screen
      .getByRole("button", { name: /auth\.loginWith-github/i })
      .querySelector("svg");
    expect(githubSvg).toBeInTheDocument();

    // Check for ORCID SVG
    const orcidSvg = screen
      .getByRole("button", { name: /auth\.loginWith-orcid/i })
      .querySelector("svg");
    expect(orcidSvg).toBeInTheDocument();
  });

  it("renders divider between email and OAuth providers", async () => {
    render(await LoginForm(defaultProps));

    expect(screen.getByText("auth.or")).toBeInTheDocument();
  });

  it("renders all buttons with correct styling", async () => {
    render(await LoginForm(defaultProps));
    // Find the email submit button by its accessible name
    const emailButton = screen.getByRole("button", { name: "auth.continueWithEmail" });
    expect(emailButton).toHaveAttribute("data-variant", "default");
    expect(emailButton).toHaveClass("h-12", "w-full");
    expect(emailButton).toHaveAttribute("type", "submit");

    const githubButton = screen.getByRole("button", { name: /auth\.loginWith-github/i });
    const orcidButton = screen.getByRole("button", { name: /auth\.loginWith-orcid/i });

    [githubButton, orcidButton].forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveClass("w-full");
      expect(button).toHaveAttribute("type", "submit");
    });
  });

  it("renders providers in correct order (email first, then OAuth)", async () => {
    render(await LoginForm(defaultProps));

    const buttons = screen.getAllByRole("button");

    expect(buttons[0]).toHaveTextContent("auth.continueWithEmail");
    expect(buttons[1]).toHaveTextContent("auth.loginWith-github");
    expect(buttons[2]).toHaveTextContent("auth.loginWith-orcid");
  });

  it("renders forms with correct structure", async () => {
    render(await LoginForm(defaultProps));

    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(3); // One form for each provider

    // Check that each form has a submit button
    forms.forEach((form) => {
      const submitButton = form.querySelector('button[type="submit"]');
      expect(submitButton).toBeInTheDocument();
    });
  });

  it("renders with undefined callbackUrl", async () => {
    const propsWithoutCallback = {
      ...defaultProps,
      callbackUrl: undefined,
    };

    render(await LoginForm(propsWithoutCallback));

    // Should still render all the basic elements
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
  });

  it("renders forms with proper action attributes", async () => {
    render(await LoginForm(defaultProps));

    const forms = document.querySelectorAll("form");

    // All forms should have action attributes (server actions)
    forms.forEach((form) => {
      expect(form).toHaveAttribute("action");
    });
  });

  it("only renders one email input", async () => {
    render(await LoginForm(defaultProps));

    // Should only have one email input
    const emailInputs = document.querySelectorAll('input[type="email"]');
    expect(emailInputs).toHaveLength(1);
  });

  it("renders provider buttons with proper submit types", async () => {
    render(await LoginForm(defaultProps));

    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);

    // Each button should be inside a form
    submitButtons.forEach((button) => {
      expect(button.closest("form")).toBeInTheDocument();
    });
  });

  it("renders OAuth providers container", async () => {
    render(await LoginForm(defaultProps));

    const container = document.querySelector(".grid.gap-3");
    expect(container).toBeInTheDocument();

    expect(container?.children.length).toBe(2); // GitHub and ORCID
  });

  it("handles different locale", async () => {
    const propsWithDifferentLocale = {
      ...defaultProps,
      locale: "de-DE" as Locale,
    };

    render(await LoginForm(propsWithDifferentLocale));

    // Should still render (translations will return keys with our mock)
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
  });

  it("renders with empty string callbackUrl", async () => {
    const propsWithEmptyCallback = {
      ...defaultProps,
      callbackUrl: "",
    };

    render(await LoginForm(propsWithEmptyCallback));

    // Should still render all elements
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);
  });

  it("renders provider image components correctly", async () => {
    render(await LoginForm(defaultProps));

    // Check that GitHub icon has the correct path content
    const githubButton = screen.getByRole("button", { name: /auth\.loginWith-github/i });
    const githubSvg = githubButton.querySelector("svg");
    const githubPath = githubSvg?.querySelector("path");
    expect(githubPath).toHaveAttribute("fill", "currentColor");

    // Check that ORCID icon has the correct path content and fill color
    const orcidButton = screen.getByRole("button", { name: /auth\.loginWith-orcid/i });
    const orcidSvg = orcidButton.querySelector("svg");
    const orcidPath = orcidSvg?.querySelector("path");
    expect(orcidPath).toHaveAttribute("fill", "#A6CE39");
  });

  it("renders correct provider map length", async () => {
    render(await LoginForm(defaultProps));

    // Should have exactly 3 providers as mocked
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);

    // Should have exactly 3 forms
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(3);
  });

  it("renders terms and conditions dialog", async () => {
    render(await LoginForm(defaultProps));

    // Check for terms prefix text and link
    expect(screen.getByText("auth.termsPrefix")).toBeInTheDocument();
    expect(screen.getByText("auth.terms")).toBeInTheDocument();

    // Check that dialog components are rendered
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByText("Terms and Conditions")).toBeInTheDocument();
    expect(screen.getByText("Mock terms and conditions content")).toBeInTheDocument();
  });
});
