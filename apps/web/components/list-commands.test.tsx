import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListCommands } from "./list-commands";

vi.mock("~/components/command-overview-cards", () => ({
  CommandOverviewCards: (props: { commands?: unknown[]; isLoading: boolean }) => (
    <div data-testid="command-overview-cards" data-loading={props.isLoading}>
      {props.commands === undefined ? "Loading..." : `${props.commands.length} commands`}
    </div>
  ),
}));

describe("ListCommands", () => {
  it("renders search input and filter", () => {
    server.mount(contract.commands.listCommands, { body: [] });
    render(<ListCommands />);

    expect(screen.getByPlaceholderText("commands.searchCommands")).toBeInTheDocument();
  });

  it("passes data to CommandOverviewCards", async () => {
    server.mount(contract.commands.listCommands, {
      body: [createCommand({ id: "1", name: "P1" })],
    });
    render(<ListCommands />);

    await waitFor(() => {
      expect(screen.getByTestId("command-overview-cards")).toHaveTextContent("1 commands");
    });
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.commands.listCommands, { body: [] });
    const user = userEvent.setup();
    render(<ListCommands />);

    await user.type(screen.getByPlaceholderText("commands.searchCommands"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });
});
