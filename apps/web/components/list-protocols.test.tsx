import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { ListProtocols } from "./list-protocols";

vi.mock("~/components/protocol-overview-cards", () => ({
  ProtocolOverviewCards: (props: { protocols?: unknown[]; isLoading: boolean }) => (
    <div data-testid="protocol-overview-cards" data-loading={props.isLoading}>
      {props.protocols === undefined ? "Loading..." : `${props.protocols.length} protocols`}
    </div>
  ),
}));

describe("ListProtocols", () => {
  it("renders search input and filter", () => {
    server.mount(contract.protocols.listProtocols, { body: [] });
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
  });

  it("passes data to ProtocolOverviewCards", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "1", name: "P1" })],
    });
    render(<ListProtocols />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-overview-cards")).toHaveTextContent("1 protocols");
    });
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { body: [] });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });
});
