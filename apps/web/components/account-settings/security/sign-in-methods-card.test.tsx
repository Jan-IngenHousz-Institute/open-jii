import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { SignInMethodsCard } from "./sign-in-methods-card";

describe("SignInMethodsCard", () => {
  beforeEach(() => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
  });

  it("shows both sign-in methods with the email always on", () => {
    render(<SignInMethodsCard />);

    expect(screen.getByText("signInMethods.emailTitle")).toBeInTheDocument();
    expect(screen.getByText("signInMethods.emailBadge")).toBeInTheDocument();
    expect(screen.getByText("signInMethods.passkeysTitle")).toBeInTheDocument();
  });

  it("shows the passkey count when the user has passkeys", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [
        { id: "p1", name: "MacBook", backedUp: true, createdAt: "2026-07-01T00:00:00.000Z" },
        { id: "p2", name: "Pixel", backedUp: true, createdAt: "2026-07-02T00:00:00.000Z" },
      ],
      error: null,
    });

    render(<SignInMethodsCard />);

    await waitFor(() =>
      expect(screen.getByText("signInMethods.passkeysCount")).toBeInTheDocument(),
    );
  });

  it("shows the empty badge when the user has no passkeys", async () => {
    render(<SignInMethodsCard />);

    await waitFor(() => expect(screen.getByText("signInMethods.passkeysNone")).toBeInTheDocument());
  });

  it("does not report an empty state while passkeys are still loading", () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockReturnValue(new Promise(() => undefined));

    render(<SignInMethodsCard />);

    expect(screen.getByText("signInMethods.passkeysLoading")).toBeInTheDocument();
    expect(screen.queryByText("signInMethods.passkeysNone")).not.toBeInTheDocument();
  });

  it("reports passkey data as unavailable when loading fails", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: null,
      error: { message: "Server error" },
    });

    render(<SignInMethodsCard />);

    expect(await screen.findByText("signInMethods.passkeysUnavailable")).toBeInTheDocument();
    expect(screen.queryByText("signInMethods.passkeysNone")).not.toBeInTheDocument();
  });
});
