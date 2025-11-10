import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AccountSettingsPage from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

vi.mock("~/components/account-settings/account-settings", () => ({
  AccountSettings: ({ session }: { session: unknown }) => (
    <div data-testid="account-settings">
      Account Settings - {session ? "with session" : "no session"}
    </div>
  ),
}));

// --- Tests ---
describe("AccountSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the account settings page with session", async () => {
    const mockSession = { user: { id: "123", name: "Test User" } };
    mockAuth.mockResolvedValue(mockSession);

    render(await AccountSettingsPage());

    expect(screen.getByTestId("account-settings")).toBeInTheDocument();
    expect(screen.getByTestId("account-settings")).toHaveTextContent("with session");
  });

  it("renders the account settings page without session", async () => {
    mockAuth.mockResolvedValue(null);

    render(await AccountSettingsPage());

    expect(screen.getByTestId("account-settings")).toBeInTheDocument();
    expect(screen.getByTestId("account-settings")).toHaveTextContent("no session");
  });

  it("renders with correct structure and spacing", async () => {
    const mockSession = { user: { id: "123", name: "Test User" } };
    mockAuth.mockResolvedValue(mockSession);

    const { container } = render(await AccountSettingsPage());

    const mainDiv = container.querySelector(".space-y-6");
    expect(mainDiv).toBeInTheDocument();
  });

  it("calls auth function to get session", async () => {
    const mockSession = { user: { id: "123", name: "Test User" } };
    mockAuth.mockResolvedValue(mockSession);

    await AccountSettingsPage();

    expect(mockAuth).toHaveBeenCalledTimes(1);
  });

  it("passes session to AccountSettings component", async () => {
    const mockSession = { user: { id: "123", name: "Test User", email: "test@example.com" } };
    mockAuth.mockResolvedValue(mockSession);

    render(await AccountSettingsPage());

    // The AccountSettings component should receive the session
    expect(screen.getByTestId("account-settings")).toHaveTextContent("with session");
  });

  it("handles undefined session", async () => {
    mockAuth.mockResolvedValue(undefined);

    render(await AccountSettingsPage());

    expect(screen.getByTestId("account-settings")).toHaveTextContent("no session");
  });

  it("handles auth function throwing error", async () => {
    mockAuth.mockRejectedValue(new Error("Auth failed"));

    await expect(AccountSettingsPage()).rejects.toThrow("Auth failed");
  });
});
