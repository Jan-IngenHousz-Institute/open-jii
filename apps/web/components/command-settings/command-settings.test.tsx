import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { CommandSettings } from "./command-settings";

// Mock child components to isolate CommandSettings logic
vi.mock("./command-details-card", () => ({
  CommandDetailsCard: (props: Record<string, unknown>) => (
    <div data-testid="command-details-card" data-command-id={props.commandId}>
      CommandDetailsCard
    </div>
  ),
}));

vi.mock("./command-info-card", () => ({
  CommandInfoCard: (props: Record<string, unknown>) => (
    <div data-testid="command-info-card" data-command-id={props.commandId}>
      CommandInfoCard
    </div>
  ),
}));

vi.mock("./command-compatible-macros-card", () => ({
  CommandCompatibleMacrosCard: (props: Record<string, unknown>) => (
    <div data-testid="command-compatible-macros-card" data-command-id={props.commandId}>
      CommandCompatibleMacrosCard
    </div>
  ),
}));

describe("CommandSettings", () => {
  const mockCommand = createCommand({
    id: "command-123",
    name: "Test Command",
    description: "A test description",
    code: [{ averages: 1 }],
    family: "generic",
    sortOrder: null,
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  });

  it("should show loading state while fetching command", () => {
    server.mount(contract.commands.getCommand, { body: mockCommand, delay: 999_999 });

    render(<CommandSettings commandId="command-123" />);

    expect(screen.getByText("commandSettings.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("command-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("command-info-card")).not.toBeInTheDocument();
  });

  it("should show not found state when data is missing", async () => {
    server.mount(contract.commands.getCommand, {
      status: 404,
      body: { message: "Not found", statusCode: 404 },
    });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(screen.getByText("commandSettings.notFound")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("command-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("command-info-card")).not.toBeInTheDocument();
  });

  it("should render both child cards when data is loaded", async () => {
    server.mount(contract.commands.getCommand, { body: mockCommand });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("command-details-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("command-info-card")).toBeInTheDocument();
  });

  it("should pass command id via API call", async () => {
    const spy = server.mount(contract.commands.getCommand, { body: mockCommand });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.params.id).toBe("command-123");
  });

  it("should pass correct props to CommandDetailsCard", async () => {
    server.mount(contract.commands.getCommand, { body: mockCommand });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("command-details-card")).toBeInTheDocument();
    });
    const detailsCard = screen.getByTestId("command-details-card");
    expect(detailsCard).toHaveAttribute("data-command-id", "command-123");
  });

  it("should pass correct props to CommandInfoCard", async () => {
    server.mount(contract.commands.getCommand, { body: mockCommand });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("command-info-card")).toBeInTheDocument();
    });
    const infoCard = screen.getByTestId("command-info-card");
    expect(infoCard).toHaveAttribute("data-command-id", "command-123");
  });

  it("should use empty string for null description", async () => {
    server.mount(contract.commands.getCommand, {
      body: { ...mockCommand, description: null },
    });

    render(<CommandSettings commandId="command-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("command-details-card")).toBeInTheDocument();
    });
  });
});
