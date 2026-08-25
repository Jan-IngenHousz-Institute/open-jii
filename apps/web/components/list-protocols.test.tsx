import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListProtocols } from "./list-protocols";

vi.mock("~/components/protocol-overview-cards", () => ({
  ProtocolOverviewCards: (props: { protocols?: unknown[] }) => (
    <div data-testid="protocol-overview-cards">
      {props.protocols === undefined ? "Loading..." : `${props.protocols.length} protocols`}
    </div>
  ),
}));

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("ListProtocols", () => {
  it("renders the search input without a my/all filter toggle", () => {
    server.mount(contract.protocols.listProtocolsPaginated, { body: envelope([]) });
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("passes data to ProtocolOverviewCards", async () => {
    server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([createProtocol({ id: "1", name: "P1" })]),
    });
    render(<ListProtocols />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-overview-cards")).toHaveTextContent("1 protocols");
    });
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });

  it("navigates pages via the pagination controls", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createProtocol({ id: "1" })], Number(call.query.page), 2),
    });
    const user = userEvent.setup();
    render(<ListProtocols />);

    const next = await screen.findByRole("button", { name: "pagination.next" });
    await user.click(next);

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });
});
