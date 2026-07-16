import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { PasskeyCreatePrompt } from "./passkey-create-prompt";

describe("PasskeyCreatePrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue(null);
  });

  it("invites a passkey-less user and creates a passkey in place", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt />);

    expect(await screen.findByText("passkeys.promptTitle")).toBeInTheDocument();
    expect(sessionStorage.getItem("openjii.passkey-prompt-shown")).toBe("true");

    await user.click(screen.getByRole("button", { name: "passkeys.promptAction" }));

    await waitFor(() => expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({}));
    expect(await screen.findByText("passkeys.promptSuccessTitle")).toBeInTheDocument();
    expect(localStorage.getItem("openjii.passkey-prompt-dismissed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "passkeys.promptDone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a destructive toast and stays on the invite when creation fails", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "cancelled" },
    } as never);
    const user = userEvent.setup();
    render(<PasskeyCreatePrompt />);

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
    render(<PasskeyCreatePrompt />);

    await user.click(await screen.findByRole("button", { name: "passkeys.promptNotNow" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(localStorage.getItem("openjii.passkey-prompt-count")).toBe("1");
  });

  it("does not prompt when the user already has a passkey", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [{ id: "p1" }],
      error: null,
    });
    render(<PasskeyCreatePrompt />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not prompt when dismissed or over the cap", async () => {
    localStorage.setItem("openjii.passkey-prompt-count", "3");
    render(<PasskeyCreatePrompt />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not prompt right after a passkey sign-in", async () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("passkey");
    render(<PasskeyCreatePrompt />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
