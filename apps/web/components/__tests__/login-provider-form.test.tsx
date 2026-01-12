import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { LoginProviderForm } from "../login-provider-form";

globalThis.React = React;

/* -------------------- Mocks -------------------- */

// Mock i18n
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "auth.email": "Email",
    "auth.emailPlaceholder": "Enter your email",
    "auth.emailRequired": "Email is required",
    "auth.emailInvalid": "Invalid email address",
    "auth.sendEmail": "Send Email",
    "auth.sendingEmail": "Sending...",
    "auth.continueWithEmail": "Sign in with Email",
    "auth.continueWith": "Continue with",
    "auth.signInWith": "Sign in with",
    "auth.loginWith-nodemailer": "Sign in with Email",
    "auth.loginWith-github": "Sign in with GitHub",
    "auth.loginWith-google": "Sign in with Google",
  };
  return translations[key] ?? key;
});

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

// Mock useRouter
const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock signInWithEmail
const mockSignInWithEmail = vi.fn();
const mockVerifyEmailCode = vi.fn();

vi.mock("../../app/actions/auth", () => ({
  signInWithEmail: vi.fn((...args: unknown[]) => mockSignInWithEmail(...args) as Promise<void>),
  verifyEmailCode: vi.fn((...args: unknown[]) => mockVerifyEmailCode(...args) as Promise<void>),
}));

/* -------------------- Helpers -------------------- */

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

/* -------------------- Tests -------------------- */

describe("LoginProviderForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("OAuth Provider", () => {
    it("renders OAuth provider button correctly", () => {
      const provider = { id: "github", name: "GitHub" };
      render(<LoginProviderForm provider={provider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const button = screen.getByRole("button", { name: /sign in with github/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Email Provider (email)", () => {
    const emailProvider = { id: "email", name: "Email" };

    it("renders email form with input and submit button", () => {
      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in with email/i })).toBeInTheDocument();
    });

    it("validates required email field", async () => {
      const user = userEvent.setup();

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      // Submit form without entering email
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it("submits form with valid email", async () => {
      const user = userEvent.setup();
      const callbackUrl = "/profile";

      mockSignInWithEmail.mockResolvedValueOnce(undefined);

      render(<LoginProviderForm provider={emailProvider} callbackUrl={callbackUrl} />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      // Enter valid email
      await user.type(emailInput, "test@example.com");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithEmail).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("disables button and shows loading state during submission", async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      mockSignInWithEmail.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      await user.type(emailInput, "test@example.com");
      await user.click(submitButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/sending/i)).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });

      // Wait for submission to complete
      await waitFor(
        () => {
          expect(screen.queryByText(/sending/i)).not.toBeInTheDocument();
        },
        { timeout: 200 },
      );
    });

    it("prevents multiple submissions while pending", async () => {
      const user = userEvent.setup();

      mockSignInWithEmail.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      await user.type(emailInput, "test@example.com");

      // Click multiple times
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      await waitFor(
        () => {
          // Should only be called once
          expect(mockSignInWithEmail).toHaveBeenCalledTimes(1);
        },
        { timeout: 200 },
      );
    });

    it("disables submit button when form is invalid", async () => {
      const user = userEvent.setup();

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      // Initially button should be enabled (form is pristine)
      expect(submitButton).not.toBeDisabled();

      // Type invalid email and make form dirty
      await user.type(emailInput, "invalid");

      // Button should be disabled for invalid input
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it("uses translations for validation messages", async () => {
      const user = userEvent.setup();

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);

      // Trigger required validation
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(mockT).toHaveBeenCalledWith("auth.emailRequired");
      });

      // Clear and type invalid email
      await user.clear(emailInput);
      await user.type(emailInput, "invalid");
      await user.tab();

      await waitFor(() => {
        expect(mockT).toHaveBeenCalledWith("auth.emailInvalid");
      });
    });
  });
});
