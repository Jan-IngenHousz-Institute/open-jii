import { useSignInEmail, useVerifyEmail } from "@/hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

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

// Mock useAuth hooks
const mockSignInMutateAsync = vi.fn();
const mockVerifyMutateAsync = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useSession: () => ({ data: null }),
  useSignInEmail: vi.fn(() => ({
    mutateAsync: mockSignInMutateAsync,
    isPending: false,
  })),
  useVerifyEmail: vi.fn(() => ({
    mutateAsync: mockVerifyMutateAsync,
    isPending: false,
  })),
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // empty
    }
    unobserve() {
      // empty
    }
    disconnect() {
      // empty
    }
  };
});

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
    vi.mocked(useSignInEmail).mockReturnValue({
      mutateAsync: mockSignInMutateAsync,
      isPending: false,
    });
    vi.mocked(useVerifyEmail).mockReturnValue({
      mutateAsync: mockVerifyMutateAsync,
      isPending: false,
    });
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

      mockSignInMutateAsync.mockResolvedValueOnce({});

      render(<LoginProviderForm provider={emailProvider} callbackUrl={callbackUrl} />, {
        wrapper: createWrapper(),
      });

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole("button", { name: /sign in with email/i });

      // Enter valid email
      await user.type(emailInput, "test@example.com");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInMutateAsync).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("disables button and shows loading state during submission", () => {
      // Mock the hook to return isPending: true
      vi.mocked(useSignInEmail).mockReturnValue({
        mutateAsync: mockSignInMutateAsync,
        isPending: true,
      });

      render(<LoginProviderForm provider={emailProvider} callbackUrl="/dashboard" />, {
        wrapper: createWrapper(),
      });

      const submitButton = screen.getByRole("button", { name: /sending/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText("Sending...")).toBeInTheDocument();
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
