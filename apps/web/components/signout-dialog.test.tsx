import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SignOutDialog } from "./signout-dialog";

globalThis.React = React;

// ---- Wrapper ----
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

// ---- Mocks ----

const mockBack = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

const mockSignOutMutateAsync = vi.fn();
vi.mock("../hooks/useAuth", () => ({
  useSignOut: () => ({
    mutateAsync: mockSignOutMutateAsync,
    isPending: false,
  }),
}));

// Mock UI components from @repo/ui
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    type,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    variant?: string;
  }) => (
    <button type={type} onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

describe("<SignOutDialog />", () => {
  const mockTranslations = {
    title: "Sign Out",
    description: "Are you sure you want to sign out?",
    cancel: "Cancel",
    confirm: "Confirm",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBack.mockClear();
    mockSignOutMutateAsync.mockClear();
  });

  it("renders the dialog with correct translations", () => {
    render(<SignOutDialog translations={mockTranslations} />, { wrapper: createWrapper() });

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Sign Out");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Are you sure you want to sign out?",
    );
  });

  it("renders cancel and confirm buttons with correct labels", () => {
    render(<SignOutDialog translations={mockTranslations} />, { wrapper: createWrapper() });

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });

    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveAttribute("data-variant", "ghost");
    expect(confirmButton).toBeInTheDocument();
    expect(confirmButton).toHaveAttribute("data-variant", "default");
  });

  it("calls router.back() when cancel button is clicked", () => {
    render(<SignOutDialog translations={mockTranslations} />, { wrapper: createWrapper() });

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockBack).toHaveBeenCalled();
  });

  it("calls handleLogout when confirm button is clicked", () => {
    render(<SignOutDialog translations={mockTranslations} />, { wrapper: createWrapper() });

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    expect(mockSignOutMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("renders with custom translations", () => {
    const customTranslations = {
      title: "Abmelden",
      description: "Möchten Sie sich wirklich abmelden?",
      cancel: "Abbrechen",
      confirm: "Bestätigen",
    };

    render(<SignOutDialog translations={customTranslations} />, { wrapper: createWrapper() });

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Abmelden");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Möchten Sie sich wirklich abmelden?",
    );
    expect(screen.getByRole("button", { name: /Abbrechen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bestätigen/i })).toBeInTheDocument();
  });
});
