import { render, waitFor } from "@/test/test-utils";
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

  it("prompts a passkey-less user once", async () => {
    render(<PasskeyCreatePrompt locale="en-US" />);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "passkeys.promptTitle" }),
      ),
    );
    expect(sessionStorage.getItem("openjii.passkey-prompt-shown")).toBe("true");
    expect(localStorage.getItem("openjii.passkey-prompt-count")).toBe("1");
  });

  it("does not prompt when the user already has a passkey", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [{ id: "p1" }],
      error: null,
    });
    render(<PasskeyCreatePrompt locale="en-US" />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not prompt when dismissed or over the cap", async () => {
    localStorage.setItem("openjii.passkey-prompt-count", "3");
    render(<PasskeyCreatePrompt locale="en-US" />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not prompt right after a passkey sign-in", async () => {
    vi.mocked(authClient.getLastUsedLoginMethod).mockReturnValue("passkey");
    render(<PasskeyCreatePrompt locale="en-US" />);

    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
  });
});
