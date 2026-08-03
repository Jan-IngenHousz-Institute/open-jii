import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { WorkbookDeleteAction } from "./workbook-delete-action";

function renderDeleteAction(overrides: Partial<ComponentProps<typeof WorkbookDeleteAction>> = {}) {
  const defaults: ComponentProps<typeof WorkbookDeleteAction> = {
    workbookId: "wb-1",
    workbookName: "My Workbook",
    usedBy: 0,
    canManage: true,
  };
  return render(<WorkbookDeleteAction {...defaults} {...overrides} />);
}

describe("<WorkbookDeleteAction />", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
  });

  it("offers delete to a caller who may manage the workbook", () => {
    renderDeleteAction({ canManage: true });

    expect(screen.getByRole("button", { name: "workbooks.actions.delete" })).toBeInTheDocument();
  });

  it("renders nothing for a viewer", () => {
    // A grantee with read-only access, or a plain public reader, gains no control
    // — the affordance is absent rather than present-and-403ing.
    const { container } = renderDeleteAction({ canManage: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("hides delete for an in-use workbook while the deletion flag is off", () => {
    // Deleting an attached workbook unlinks experiments and loses their
    // measurement flow — a separate safety gate from authorization.
    const { container } = renderDeleteAction({ canManage: true, usedBy: 2 });

    expect(container).toBeEmptyDOMElement();
  });

  it("offers delete for an in-use workbook once the flag is on", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    renderDeleteAction({ canManage: true, usedBy: 2 });

    expect(screen.getByRole("button", { name: "workbooks.actions.delete" })).toBeInTheDocument();
  });

  it("confirms, deletes, and navigates away from the deleted workbook", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    const { router } = renderDeleteAction({ workbookId: "wb-42" });

    await user.click(screen.getByRole("button", { name: "workbooks.actions.delete" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("workbooks.messages.deleteConfirm")).toBeInTheDocument();
    expect(spy.called).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "workbooks.actions.delete" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "wb-42" });
    // The page was showing the workbook that no longer exists.
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en-US/platform/workbooks"));
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    renderDeleteAction();

    await user.click(screen.getByRole("button", { name: "workbooks.actions.delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "common.cancel" }));

    expect(spy.called).toBe(false);
  });

  it("warns about attached experiments in the confirmation", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    server.mount(contract.workbooks.deleteWorkbook, { status: 204 });

    renderDeleteAction({ usedBy: 3 });

    await user.click(screen.getByRole("button", { name: "workbooks.actions.delete" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(within(dialog).getByText("workbooks.messages.deleteInUseConfirm")).toBeInTheDocument();
  });
});
