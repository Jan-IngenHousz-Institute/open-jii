import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { MemberDialogs } from "./member-dialogs";

// Minimal mock for i18n - just returns the key
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("<MemberDialogs />", () => {
  it("shows last admin warning dialog for leave action", () => {
    const onClose = vi.fn();

    render(
      <MemberDialogs
        showLastAdminDialog={true}
        showLeaveConfirmDialog={false}
        showDemoteConfirmDialog={false}
        lastAdminAction="leave"
        onLastAdminDialogChange={onClose}
        onLeaveConfirmDialogChange={vi.fn()}
        onDemoteConfirmDialogChange={vi.fn()}
        onConfirmLeave={vi.fn()}
        onConfirmDemote={vi.fn()}
      />,
    );

    expect(screen.getByText("experimentSettings.cannotLeaveAsLastAdmin")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.lastAdminWarning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.ok" })).toBeInTheDocument();
  });

  it("shows last admin warning dialog for demote action", () => {
    const onClose = vi.fn();

    render(
      <MemberDialogs
        showLastAdminDialog={true}
        showLeaveConfirmDialog={false}
        showDemoteConfirmDialog={false}
        lastAdminAction="demote"
        onLastAdminDialogChange={onClose}
        onLeaveConfirmDialogChange={vi.fn()}
        onDemoteConfirmDialogChange={vi.fn()}
        onConfirmLeave={vi.fn()}
        onConfirmDemote={vi.fn()}
      />,
    );

    expect(screen.getByText("experimentSettings.cannotDemoteAsLastAdmin")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.lastAdminDemoteWarning")).toBeInTheDocument();
  });

  it("shows leave confirmation dialog with cancel and confirm buttons", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <MemberDialogs
        showLastAdminDialog={false}
        showLeaveConfirmDialog={true}
        showDemoteConfirmDialog={false}
        lastAdminAction="leave"
        onLastAdminDialogChange={vi.fn()}
        onLeaveConfirmDialogChange={onCancel}
        onDemoteConfirmDialogChange={vi.fn()}
        onConfirmLeave={onConfirm}
        onConfirmDemote={vi.fn()}
      />,
    );

    expect(screen.getByText("experimentSettings.confirmLeaveTitle")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.confirmLeaveMessage")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "experimentSettings.confirmLeave" });
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows demote confirmation dialog with cancel and confirm buttons", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <MemberDialogs
        showLastAdminDialog={false}
        showLeaveConfirmDialog={false}
        showDemoteConfirmDialog={true}
        lastAdminAction="demote"
        onLastAdminDialogChange={vi.fn()}
        onLeaveConfirmDialogChange={vi.fn()}
        onDemoteConfirmDialogChange={onCancel}
        onConfirmLeave={vi.fn()}
        onConfirmDemote={onConfirm}
      />,
    );

    expect(screen.getByText("experimentSettings.confirmDemoteTitle")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.confirmDemoteMessage")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: "experimentSettings.confirmDemote",
    });
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render any dialogs when all are closed", () => {
    render(
      <MemberDialogs
        showLastAdminDialog={false}
        showLeaveConfirmDialog={false}
        showDemoteConfirmDialog={false}
        lastAdminAction="leave"
        onLastAdminDialogChange={vi.fn()}
        onLeaveConfirmDialogChange={vi.fn()}
        onDemoteConfirmDialogChange={vi.fn()}
        onConfirmLeave={vi.fn()}
        onConfirmDemote={vi.fn()}
      />,
    );

    // No dialog titles should be visible
    expect(screen.queryByText("experimentSettings.cannotLeaveAsLastAdmin")).not.toBeInTheDocument();
    expect(screen.queryByText("experimentSettings.confirmLeaveTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("experimentSettings.confirmDemoteTitle")).not.toBeInTheDocument();
  });
});
