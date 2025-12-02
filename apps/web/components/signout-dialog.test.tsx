import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SignOutDialog } from "./signout-dialog";

globalThis.React = React;

// ---- Mocks ----

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
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
    mockPush.mockClear();
  });

  it("renders the dialog with correct translations", () => {
    const mockOnOpenChange = vi.fn();
    render(
      <SignOutDialog open={true} onOpenChange={mockOnOpenChange} translations={mockTranslations} />,
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Sign Out");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Are you sure you want to sign out?",
    );
  });

  it("renders cancel and confirm buttons with correct labels", () => {
    const mockOnOpenChange = vi.fn();
    render(
      <SignOutDialog open={true} onOpenChange={mockOnOpenChange} translations={mockTranslations} />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    const confirmButton = screen.getByRole("button", { name: /Confirm/i });

    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveAttribute("data-variant", "ghost");
    expect(confirmButton).toBeInTheDocument();
    expect(confirmButton).toHaveAttribute("data-variant", "default");
  });

  it("calls onOpenChange(false) when cancel button is clicked", () => {
    const mockOnOpenChange = vi.fn();
    render(
      <SignOutDialog open={true} onOpenChange={mockOnOpenChange} translations={mockTranslations} />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls router.push with logout URL when confirm button is clicked", () => {
    const mockOnOpenChange = vi.fn();
    render(
      <SignOutDialog open={true} onOpenChange={mockOnOpenChange} translations={mockTranslations} />,
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    expect(mockPush).toHaveBeenCalledWith("/api/auth/logout");
  });

  it("renders with custom translations", () => {
    const customTranslations = {
      title: "Abmelden",
      description: "Möchten Sie sich wirklich abmelden?",
      cancel: "Abbrechen",
      confirm: "Bestätigen",
    };

    const mockOnOpenChange = vi.fn();
    render(
      <SignOutDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        translations={customTranslations}
      />,
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Abmelden");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Möchten Sie sich wirklich abmelden?",
    );
    expect(screen.getByRole("button", { name: /Abbrechen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bestätigen/i })).toBeInTheDocument();
  });
});
