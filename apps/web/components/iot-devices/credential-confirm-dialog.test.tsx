import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CredentialConfirmDialog } from "./credential-confirm-dialog";

function renderDialog(overrides: Partial<Parameters<typeof CredentialConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <CredentialConfirmDialog
      open
      onOpenChange={vi.fn()}
      title="Rotate?"
      description="Old certificate stops working."
      actionLabel="Rotate"
      pending={false}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm };
}

describe("CredentialConfirmDialog", () => {
  it("confirms without closing, so the pending state stays visible", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    expect(screen.getByText("Old certificate stops working.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rotate" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows the disconnect warning only when one is passed", () => {
    renderDialog({ warning: "1 device will disconnect." });

    expect(screen.getByText("1 device will disconnect.")).toBeInTheDocument();
  });

  it("locks both buttons while the mutation runs", () => {
    renderDialog({ pending: true });

    expect(screen.getByRole("button", { name: "common.cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Rotate" })).not.toBeInTheDocument();
  });
});
