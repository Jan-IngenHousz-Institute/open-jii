import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteDeviceGroupDialog } from "./delete-device-group-dialog";

interface RenderOptions {
  isPending?: boolean;
  onConfirm?: () => void;
}

function renderDialog(options: RenderOptions = {}) {
  render(
    <DeleteDeviceGroupDialog
      open
      onOpenChange={vi.fn()}
      groupName="Greenhouse A"
      isPending={options.isPending ?? false}
      onConfirm={options.onConfirm ?? vi.fn()}
    />,
  );
}

describe("DeleteDeviceGroupDialog", () => {
  it("renders the title and the named hint", () => {
    renderDialog();

    expect(screen.getByText("iot.groups.deleteTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.deleteHint")).toBeInTheDocument();
  });

  it("confirms the delete", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByText("iot.groups.delete"));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both actions while pending", () => {
    renderDialog({ isPending: true });

    // The action swaps its label for a spinner while pending.
    expect(screen.queryByText("iot.groups.delete")).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
