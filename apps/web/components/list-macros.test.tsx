import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ListMacros } from "./list-macros";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("ListMacros", () => {
  it("renders search input and language filter, but no my/all toggle", async () => {
    server.mount(contract.macros.listMacrosPaginated, { body: envelope([]) });
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("macros.allLanguages")).toBeInTheDocument();
    await screen.findByText("macros.noMacros");
    expect(screen.queryByText("macros.filterMacros")).not.toBeInTheDocument();
  });

  it("renders macros as table rows linking to their detail pages", async () => {
    server.mount(contract.macros.listMacrosPaginated, {
      body: envelope([createMacro({ id: "1", name: "M1" })]),
    });
    render(<ListMacros />);

    const link = await screen.findByRole("link", { name: "M1" });
    expect(link.getAttribute("href")).toContain("/platform/macros/1");
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
