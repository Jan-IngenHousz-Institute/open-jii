import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationDeleteDialog } from "./calibration-delete-dialog";

interface RenderOptions {
  isPending?: boolean;
  onConfirm?: () => void;
  onOpenChange?: (open: boolean) => void;
}

function renderDialog(options: RenderOptions = {}) {
  render(
    <CalibrationDeleteDialog
      open
      onOpenChange={options.onOpenChange ?? vi.fn()}
      definitionName="MiniPAR PAR calibration"
      isPending={options.isPending ?? false}
      onConfirm={options.onConfirm ?? vi.fn()}
    />,
  );
}

describe("CalibrationDeleteDialog", () => {
  it("names what will be deleted", () => {
    renderDialog();

    expect(screen.getByText("iot.calibration.detail.deleteTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.detail.deleteHint")).toBeInTheDocument();
  });

  it("confirms the delete and stays open for it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });

    await user.click(screen.getByText("iot.calibration.detail.delete"));

    expect(onConfirm).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });

    await user.click(screen.getByText("common.cancel"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cannot be confirmed or cancelled while the delete is in flight", () => {
    renderDialog({ isPending: true });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
