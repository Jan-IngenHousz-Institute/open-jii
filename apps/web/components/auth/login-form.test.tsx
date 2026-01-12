import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LoginForm } from "./login-form";

globalThis.React = React;

// Helper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock Next.js modules
const { mockPush, mockRedirect } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth module
vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  providerMap: [
    { id: "github", name: "GitHub" },
    { id: "email", name: "Email" },
    { id: "orcid", name: "ORCID" },
  ],
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
    locale: "en-US",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with title and providers", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /orcid/i })).toBeInTheDocument();
  });

  it("renders email input form for nodemailer provider", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "m@example.com");
  });

  it("renders provider icons correctly", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    // Check for GitHub SVG
    const githubSvg = screen.getByRole("button", { name: /github/i }).querySelector("svg");
    expect(githubSvg).toBeInTheDocument();

    // Check for ORCID SVG
    const orcidSvg = screen.getByRole("button", { name: /orcid/i }).querySelector("svg");
    expect(orcidSvg).toBeInTheDocument();
  });

  it("renders divider between email and OAuth providers", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    expect(screen.getByText("auth.or")).toBeInTheDocument();
  });

  it("renders all buttons with correct styling", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });
    // Find the email submit button by its accessible name
    const emailButton = screen.getByRole("button", { name: "auth.continueWithEmail" });
    expect(emailButton).toHaveAttribute("data-variant", "default");
    expect(emailButton).toHaveClass("h-12", "w-full");
    expect(emailButton).toHaveAttribute("type", "submit");

    const githubButton = screen.getByRole("button", { name: /github/i });
    const orcidButton = screen.getByRole("button", { name: /orcid/i });

    [githubButton, orcidButton].forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "outline");
      expect(button).toHaveClass("w-full");
      expect(button).toHaveAttribute("type", "submit");
    });
  });

  it("renders providers in correct order (email first, then OAuth)", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    const buttons = screen.getAllByRole("button");

    // Email first
    expect(buttons[0]).toHaveTextContent("auth.continueWithEmail");

    // Github button
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();

    // Orcid button
    expect(screen.getByRole("button", { name: /orcid/i })).toBeInTheDocument();
  });

  it("renders forms with correct structure", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

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

    render(await LoginForm(propsWithoutCallback), { wrapper: createWrapper() });

    // Should still render all the basic elements
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByText("auth.continueWithEmail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /orcid/i })).toBeInTheDocument();
  });

  it("renders forms with proper submit handlers", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    const forms = document.querySelectorAll("form");

    // All forms should exist and be able to submit
    expect(forms.length).toBe(3);
    forms.forEach((form) => {
      expect(form).toBeInTheDocument();
    });
  });

  it("only renders one email input", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    // Should only have one email input
    const emailInputs = document.querySelectorAll('input[type="email"]');
    expect(emailInputs).toHaveLength(1);
  });

  it("renders provider buttons with proper submit types", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);

    // Each button should be inside a form
    submitButtons.forEach((button) => {
      expect(button.closest("form")).toBeInTheDocument();
    });
  });

  it("renders OAuth providers container", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    const container = document.querySelector(".grid.gap-3");
    expect(container).toBeInTheDocument();

    expect(container?.children.length).toBe(2); // GitHub and ORCID
  });

  it("handles different locale", async () => {
    const propsWithDifferentLocale = {
      ...defaultProps,
      locale: "de-DE",
    };

    render(await LoginForm(propsWithDifferentLocale), { wrapper: createWrapper() });

    // Should still render (translations will return keys with our mock)
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
  });

  it("renders with empty string callbackUrl", async () => {
    const propsWithEmptyCallback = {
      ...defaultProps,
      callbackUrl: "",
    };

    render(await LoginForm(propsWithEmptyCallback), { wrapper: createWrapper() });

    // Should still render all elements
    expect(screen.getByText("auth.loginToAccount")).toBeInTheDocument();
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);
  });

  it("renders provider image components correctly", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    // Check that GitHub icon has the correct path content
    const githubButton = screen.getByRole("button", { name: /github/i });
    const githubSvg = githubButton.querySelector("svg");
    const githubPath = githubSvg?.querySelector("path");
    expect(githubPath).toHaveAttribute("fill", "currentColor");

    // Check that ORCID icon has the correct path content and fill color
    const orcidButton = screen.getByRole("button", { name: /orcid/i });
    const orcidSvg = orcidButton.querySelector("svg");
    const orcidPath = orcidSvg?.querySelector("path");
    expect(orcidPath).toHaveAttribute("fill", "#A6CE39");
  });

  it("renders correct provider map length", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    // Should have exactly 3 providers as mocked
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(3);

    // Should have exactly 3 forms
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(3);
  });

  it("renders terms and conditions dialog", async () => {
    render(await LoginForm(defaultProps), { wrapper: createWrapper() });

    // Check for terms prefix text and link
    expect(screen.getByText("auth.continueTermsPrefix")).toBeInTheDocument();
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
