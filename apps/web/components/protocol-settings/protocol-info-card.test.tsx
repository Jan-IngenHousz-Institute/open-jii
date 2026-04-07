import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { ProtocolInfoCard } from "./protocol-info-card";

describe("ProtocolInfoCard", () => {
  const mockProtocol = createProtocol({
    id: "protocol-123",
    name: "Test Protocol",
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
    server.mount(contract.protocols.deleteProtocol, { status: 204 });
  });

  it("should render the protocol info card with correct data", () => {
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    // Check titles
    expect(screen.getByText("protocolSettings.protocolInfo")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.protocolInfoDescription")).toBeInTheDocument();

    // Check creation and update dates
    expect(screen.getByText("protocolSettings.created:")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2023-01-01T00:00:00Z"))).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.updated:")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2023-01-02T00:00:00Z"))).toBeInTheDocument();

    // Check ID
    expect(screen.getByText("protocols.protocolId:")).toBeInTheDocument();
    expect(screen.getByText("protocol-123")).toBeInTheDocument();
  });

  it("should render the danger zone section when feature flag is enabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    expect(screen.getByText("protocolSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.deleteWarning")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.deleteProtocol")).toBeInTheDocument();
  });

  it("should not render delete button when feature flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);

    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("protocolSettings.deleteProtocol")).not.toBeInTheDocument();
  });

  it("should open the delete confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    await user.click(deleteButton);

    // The dialog text is broken up into multiple elements, so we use a more flexible approach
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("common.confirmDelete");
    expect(screen.getByText("protocolSettings.cancel")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.delete")).toBeInTheDocument();
  });

  it("should close the dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    // Open the dialog
    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    await user.click(deleteButton);

    // Check that the dialog is open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("common.confirmDelete");

    // Click cancel
    const cancelButton = screen.getByText("protocolSettings.cancel");
    await user.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should handle delete when confirmed", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.protocols.deleteProtocol, { status: 204 });

    const { router } = render(
      <ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />,
    );

    // Open the dialog
    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    await user.click(deleteButton);

    // Click delete
    const confirmDeleteButton = screen.getByText("protocolSettings.delete");
    await user.click(confirmDeleteButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(spy.params).toEqual({ id: "protocol-123" });
      expect(router.push).toHaveBeenCalledWith("/en-US/platform/protocols");
    });
  });
});
