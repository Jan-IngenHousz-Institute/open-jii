import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { PasskeyCreatePrompt } from "./passkey-create-prompt";

const defaultProps = { userId: "user-1", sessionId: "session-1" };
const dismissedKey = "openjii.passkey-prompt-dismissed:user-1";
const countKey = "openjii.passkey-prompt-count:user-1";
const shownKey = "openjii.passkey-prompt-shown:user-1:session-1";

describe("PasskeyCreatePrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredential {});
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invites a passkey-less user and creates a passkey in place", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt {...defaultProps} />);

    expect(await screen.findByText("passkeys.promptTitle")).toBeInTheDocument();
    expect(localStorage.getItem(shownKey)).toBe("true");

    await user.click(screen.getByRole("button", { name: "passkeys.promptAction" }));

    await waitFor(() => expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({}));
    expect(await screen.findByText("passkeys.promptSuccessTitle")).toBeInTheDocument();
    expect(localStorage.getItem(dismissedKey)).toBe("true");

    await user.click(screen.getByRole("button", { name: "passkeys.promptDone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a destructive toast and stays on the invite when creation fails", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "cancelled" },
    } as never);
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt {...defaultProps} />);

    await user.click(await screen.findByRole("button", { name: "passkeys.promptAction" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "passkeys.addError",
        variant: "destructive",
      }),
    );
    expect(screen.queryByText("passkeys.promptSuccessTitle")).not.toBeInTheDocument();
  });

  it("closes on Not now and counts the prompt", async () => {
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt {...defaultProps} />);

    await user.click(await screen.findByRole("button", { name: "passkeys.promptNotNow" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(localStorage.getItem(countKey)).toBe("1");
  });

  it("does not count the third prompt until the user dismisses it", async () => {
    localStorage.setItem(countKey, "2");
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt {...defaultProps} />);

    expect(await screen.findByText("passkeys.promptTitle")).toBeInTheDocument();
    expect(localStorage.getItem(countKey)).toBe("2");
    expect(localStorage.getItem(dismissedKey)).toBeNull();

    await user.click(screen.getByRole("button", { name: "passkeys.promptNotNow" }));

    expect(localStorage.getItem(countKey)).toBe("3");
    expect(localStorage.getItem(dismissedKey)).toBe("true");
  });

  it("scopes prompt suppression to the current user and auth session", async () => {
    localStorage.setItem("openjii.passkey-prompt-dismissed:user-2", "true");
    localStorage.setItem("openjii.passkey-prompt-shown:user-1:old-session", "true");

    render(<PasskeyCreatePrompt {...defaultProps} />);

    expect(await screen.findByText("passkeys.promptTitle")).toBeInTheDocument();
    expect(localStorage.getItem(shownKey)).toBe("true");
    expect(localStorage.getItem("openjii.passkey-prompt-shown:user-1:old-session")).toBeNull();
  });

  it("does not repeat the prompt in another tab for the same auth session", async () => {
    localStorage.setItem(shownKey, "true");

    render(<PasskeyCreatePrompt {...defaultProps} />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not prompt when WebAuthn is unavailable", async () => {
    vi.stubGlobal("PublicKeyCredential", undefined);

    render(<PasskeyCreatePrompt {...defaultProps} />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(shownKey)).toBeNull();
  });

  it("does not prompt when the user already has a passkey", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [{ id: "p1" }],
      error: null,
    });
    render(<PasskeyCreatePrompt {...defaultProps} />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not prompt when dismissed or over the cap", async () => {
    localStorage.setItem(countKey, "3");
    render(<PasskeyCreatePrompt {...defaultProps} />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not prompt right after a passkey sign-in", async () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("passkey");
    render(<PasskeyCreatePrompt {...defaultProps} />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
