import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListMacros } from "./list-macros";

vi.mock("~/components/macro-overview-cards", () => ({
  MacroOverviewCards: (props: { macros?: unknown[]; isLoading: boolean }) => (
    <div data-testid="macro-cards" data-loading={props.isLoading}>
      {props.macros?.length ?? 0} macros
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

describe("ListMacros", () => {
  it("renders search input and language filter, but no my/all toggle", () => {
    server.mount(contract.macros.listMacrosPaginated, { body: envelope([]) });
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("macros.allLanguages")).toBeInTheDocument();
    expect(screen.queryByText("macros.filterMacros")).not.toBeInTheDocument();
  });

  it("passes data to MacroOverviewCards", async () => {
    server.mount(contract.macros.listMacrosPaginated, {
      body: envelope([createMacro({ id: "1", name: "M1" })]),
    });
    render(<ListMacros />);

    await waitFor(() => {
      expect(screen.getByTestId("macro-cards")).toHaveTextContent("1 macros");
    });
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.macros.listMacrosPaginated, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListMacros />);

    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });

  it("navigates pages via the pagination controls", async () => {
    const spy = server.mount(contract.macros.listMacrosPaginated, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createMacro({ id: "1" })], Number(call.query.page), 2),
    });
    const user = userEvent.setup();
    render(<ListMacros />);

    const next = await screen.findByRole("button", { name: "pagination.next" });
    await user.click(next);

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });
});
