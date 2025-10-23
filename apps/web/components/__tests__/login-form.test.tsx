import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import { LoginForm } from "../login-form";

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
      t: (key: string) => {
        // Return actual translations for auth-related keys
        const translations: Record<string, string> = {
          "auth.email": "Email",
          "auth.emailPlaceholder": "m@example.com",
        };
        return translations[key] || key;
      },
    }),
  ),
}));

// Mock client-side i18n hook
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      // Return actual translations for auth-related keys
      const translations: Record<string, string> = {
        "auth.email": "Email",
        "auth.emailPlaceholder": "m@example.com",
        "auth.emailRequired": "Email is required",
        "auth.emailInvalid": "Please enter a valid email address",
        "auth.sendingEmail": "Sending you an email...",
      };
      return translations[key] || key;
    },
  })),
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
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormField: ({
    render,
    name,
  }: {
    control: unknown;
    name: string;
    render: (props: { field: unknown }) => React.ReactNode;
  }) => {
    const field = {
      name,
      value: "",
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn(),
    };
    return <div data-field-name={name}>{render({ field })}</div>;
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => {
    // Get the field name from the parent FormField to generate proper htmlFor
    return <label htmlFor="email">{children}</label>;
  },
  FormControl: ({ children }: { children: React.ReactNode }) => {
    // Clone the child element and add the id prop
    if (React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: "email" });
    }
    return <>{children}</>;
  },
  FormMessage: ({ children }: { children?: React.ReactNode }) =>
    children ? <span>{children}</span> : null,
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
    expect(screen.getByText("auth.continueWith")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-nodemailer")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
  });

  it("renders email input for nodemailer provider", async () => {
    render(await LoginForm(defaultProps));

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "m@example.com");
    // Validation is handled by zod schema, not HTML required attribute
    expect(emailInput).not.toBeRequired();
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

  it("renders 'Or continue with' separator after the first provider", async () => {
    render(await LoginForm(defaultProps));

    const separators = screen.getAllByText("auth.orContinueWith");
    // Should appear after the first provider (index > 1 condition in the code)
    expect(separators.length).toBeGreaterThan(0);
  });

  it("renders all buttons with correct styling", async () => {
    render(await LoginForm(defaultProps));

    const buttons = screen.getAllByRole("button");

    buttons.forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveClass("w-full");
      expect(button).toHaveAttribute("type", "submit");
    });
  });

  it("renders provider forms in correct order", async () => {
    render(await LoginForm(defaultProps));

    const buttons = screen.getAllByRole("button");

    expect(buttons[0]).toHaveTextContent("auth.loginWith-github");
    expect(buttons[1]).toHaveTextContent("auth.loginWith-nodemailer");
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
    expect(screen.getByText("auth.loginWith-github")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-nodemailer")).toBeInTheDocument();
    expect(screen.getByText("auth.loginWith-orcid")).toBeInTheDocument();
  });

  it("renders forms with proper submit handlers", async () => {
    render(await LoginForm(defaultProps));

    const forms = document.querySelectorAll("form");

    // All forms should exist and be able to submit
    expect(forms.length).toBe(3);
    forms.forEach((form) => {
      expect(form).toBeInTheDocument();
    });
  });

  it("renders email input with proper name attribute for form data", async () => {
    render(await LoginForm(defaultProps));

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("name", "email");
    expect(emailInput).toHaveAttribute("id", "email");
  });

  it("only renders email input for nodemailer provider", async () => {
    render(await LoginForm(defaultProps));

    // Should only have one email input (for nodemailer)
    const emailInputs = screen.getAllByDisplayValue("");
    const emailTypeInputs = emailInputs.filter((input) => input.getAttribute("type") === "email");
    expect(emailTypeInputs).toHaveLength(1);
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

  it("renders correct provider order with proper separation", async () => {
    render(await LoginForm(defaultProps));

    const container = document.querySelector(".grid.gap-6");
    expect(container).toBeInTheDocument();

    // Check that we have the expected structure
    const children = container?.children;
    expect(children?.length).toBeGreaterThan(3); // Initial separator + providers + additional separators
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
    expect(screen.getAllByRole("button")).toHaveLength(3);
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
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    // Should have exactly 3 forms
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(3);
  });

  it("renders separators correctly based on provider index", async () => {
    render(await LoginForm(defaultProps));

    // The first separator should be "Continue with"
    expect(screen.getByText("auth.continueWith")).toBeInTheDocument();

    // Should have at least one "Or continue with" separator (for providers after index 1)
    const orSeparators = screen.getAllByText("auth.orContinueWith");
    expect(orSeparators.length).toBeGreaterThanOrEqual(1);
  });
});
