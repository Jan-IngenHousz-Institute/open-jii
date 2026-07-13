import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { CommandInfoCard } from "./command-info-card";

describe("CommandInfoCard", () => {
  const mockCommand = createCommand({
    id: "command-123",
    name: "Test Command",
    description: "Test description",
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: feature flag enabled
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

    // Default: mount the delete endpoint so the real hook works
    server.mount(contract.commands.deleteCommand, { status: 204 });
  });

  it("should render the command info card with correct data", () => {
    render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    expect(screen.getByText("commandSettings.commandInfo")).toBeInTheDocument();
    expect(screen.getByText("commandSettings.commandInfoDescription")).toBeInTheDocument();

    expect(screen.getByText("commandSettings.created:")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2023-01-01T00:00:00Z"))).toBeInTheDocument();
    expect(screen.getByText("commandSettings.updated:")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2023-01-02T00:00:00Z"))).toBeInTheDocument();

    expect(screen.getByText("commands.commandId:")).toBeInTheDocument();
    expect(screen.getByText("command-123")).toBeInTheDocument();
  });

  it("should render the danger zone section when feature flag is enabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

    render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    expect(screen.getByText("commandSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("commandSettings.deleteWarning")).toBeInTheDocument();
    expect(screen.getByText("commandSettings.deleteCommand")).toBeInTheDocument();
  });

  it("should not render delete button when feature flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);

    render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    expect(screen.queryByText("commandSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("commandSettings.deleteCommand")).not.toBeInTheDocument();
  });

  it("should open the delete confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    const deleteButton = screen.getByText("commandSettings.deleteCommand");
    await user.click(deleteButton);

    // The dialog text is broken up into multiple elements, so we use a more flexible approach
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("common.confirmDelete");
    expect(screen.getByText("commandSettings.cancel")).toBeInTheDocument();
    expect(screen.getByText("commandSettings.delete")).toBeInTheDocument();
  });

  it("should close the dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    // Open the dialog
    const deleteButton = screen.getByText("commandSettings.deleteCommand");
    await user.click(deleteButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("common.confirmDelete");

    // Click cancel
    const cancelButton = screen.getByText("commandSettings.cancel");
    await user.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should handle delete when confirmed", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.commands.deleteCommand, { status: 204 });

    const { router } = render(<CommandInfoCard commandId="command-123" command={mockCommand} />);

    // Open the dialog
    const deleteButton = screen.getByText("commandSettings.deleteCommand");
    await user.click(deleteButton);

    // Click delete
    const confirmDeleteButton = screen.getByText("commandSettings.delete");
    await user.click(confirmDeleteButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(spy.params).toEqual({ id: "command-123" });
      expect(router.push).toHaveBeenCalledWith("/en-US/platform/commands");
    });
  });
});
