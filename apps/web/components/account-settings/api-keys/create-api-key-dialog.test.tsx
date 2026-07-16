import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { CreateApiKeyDialog } from "./create-api-key-dialog";

async function openDialog() {
  const user = userEvent.setup();
  render(<CreateApiKeyDialog />);
  await user.click(screen.getByRole("button", { name: "apiKeys.create" }));
  expect(screen.getByText("apiKeys.createTitle")).toBeInTheDocument();
  return user;
}

describe("CreateApiKeyDialog", () => {
  beforeEach(() => {
    vi.mocked(authClient.apiKey.create).mockResolvedValue({
      data: { key: "jii_abc123" },
      error: null,
    });
  });

  it("requires a name before creating", async () => {
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "apiKeys.createConfirm" }));

    await waitFor(() => expect(screen.getByText("apiKeys.nameRequired")).toBeInTheDocument());
    expect(authClient.apiKey.create).not.toHaveBeenCalled();
  });

  it("creates the key and shows it once with a copy button", async () => {
    const user = await openDialog();

    await user.type(screen.getByPlaceholderText("apiKeys.namePlaceholder"), "CI key");
    await user.click(screen.getByRole("button", { name: "apiKeys.createConfirm" }));

    await waitFor(() => expect(screen.getByText("jii_abc123")).toBeInTheDocument());
    expect(authClient.apiKey.create).toHaveBeenCalledWith({ name: "CI key", expiresIn: undefined });
    expect(screen.getByText("apiKeys.createdWarning")).toBeInTheDocument();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "apiKeys.copy" }));

    expect(writeText).toHaveBeenCalledWith("jii_abc123");
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows a destructive toast when creation fails", async () => {
    vi.mocked(authClient.apiKey.create).mockResolvedValue({
      data: null,
      error: { message: "Server error" },
    });
    const user = await openDialog();

    await user.type(screen.getByPlaceholderText("apiKeys.namePlaceholder"), "CI key");
    await user.click(screen.getByRole("button", { name: "apiKeys.createConfirm" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "apiKeys.createError",
        variant: "destructive",
      }),
    );
    expect(screen.getByText("apiKeys.createTitle")).toBeInTheDocument();
  });
});
