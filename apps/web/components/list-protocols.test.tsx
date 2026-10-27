import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { getSensorFamilyLabel } from "~/util/sensor-family";

import { contract } from "@repo/api/contract";
import { zProtocolFamily } from "@repo/api/domains/protocol/protocol.schema";

import { ListProtocols } from "./list-protocols";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("ListProtocols", () => {
  it("keeps route-wide create actions out of the collection toolbar", () => {
    server.mount(contract.protocols.listProtocols, { body: envelope([]) });
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "protocols.create" })).toBeNull();
  });

  it("renders the search input without a my/all filter toggle", async () => {
    server.mount(contract.protocols.listProtocols, { body: envelope([]) });
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
    await screen.findByText("protocols.noProtocols");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders protocols as table rows linking to their detail pages", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: envelope([createProtocol({ id: "1", name: "P1" })]),
    });
    render(<ListProtocols />);

    const link = await screen.findByRole("link", { name: "P1" });
    expect(link.getAttribute("href")).toContain("/platform/protocols/1");
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });

  it("distinguishes a search with no matches from an empty protocol collection", async () => {
    server.mount(contract.protocols.listProtocols, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await screen.findByText("protocols.noProtocols");
    await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "missing");

    expect(await screen.findByText("protocols.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("protocols.noProtocols")).not.toBeInTheDocument();
  });

  it("navigates pages via the pagination controls", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
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

  it("shows a recoverable error when the list request fails", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { status: 500 });
    const user = userEvent.setup();
    render(<ListProtocols />);

    expect(await screen.findByText("errors.failedToLoadProtocol")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(spy.callCount).toBeGreaterThan(1));
  });

  it("sorts by name, adds a secondary field, and resets", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([createProtocol({ id: "1", name: "First" })]),
    });
    const user = userEvent.setup();
    render(<ListProtocols />);

    await screen.findByRole("link", { name: "First" });
    expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
    expect(screen.queryByRole("button", { name: /protocols.columns.activity:/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /protocols.columns.name:/ }));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name"));

    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /protocols.columns.family:/ }));
    await user.keyboard("{/Shift}");
    expect(
      screen.getByRole("button", { name: /protocols.columns.family:.*common.sortSecondary/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[1][field]"]).toBe("family"));

    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    await waitFor(() => expect(spy.calls.at(-1)?.query.sort).toBeUndefined());
  });

  describe("family and visibility filters", () => {
    function openOnUrl(qs: string) {
      vi.mocked(nav.usePathname).mockReturnValue("/platform/protocols");
      vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
    }

    it("offers both filters and hides Clear filters while nothing is picked", () => {
      server.mount(contract.protocols.listProtocols, { body: envelope([]) });

      render(<ListProtocols />);

      expect(screen.getByRole("button", { name: "protocols.columns.family" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "protocols.visibility" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });

    it("lists the authored families without mobile and filters through the URL and the API", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.protocols.listProtocols, { body: envelope([]) });

      render(<ListProtocols />);
      await user.click(screen.getByRole("button", { name: "protocols.columns.family" }));

      const labels = screen.getAllByRole("option").map((option) => option.textContent);
      expect(labels).toEqual(zProtocolFamily.options.map(getSensorFamilyLabel));
      expect(labels).not.toContain(getSensorFamilyLabel("mobile"));
      await user.click(screen.getByRole("option", { name: getSensorFamilyLabel("ambyte") }));

      expect(replace).toHaveBeenLastCalledWith("/platform/protocols?family=ambyte", {
        scroll: false,
      });
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).toContain("family%5B0%5D=ambyte");
      });
      expect(
        screen.getByRole("button", { name: /^protocols\.columns\.family(?!:)/ }),
      ).toHaveTextContent("1");
    });

    it("lists both visibilities and filters by one", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.protocols.listProtocols, { body: envelope([]) });

      render(<ListProtocols />);
      await user.click(screen.getByRole("button", { name: "protocols.visibility" }));

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "protocols.private",
        "protocols.public",
      ]);
      await user.click(screen.getByRole("option", { name: "protocols.private" }));

      expect(replace).toHaveBeenLastCalledWith("/platform/protocols?visibility=private", {
        scroll: false,
      });
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).toContain("visibility%5B0%5D=private");
      });
    });

    it("restores a shared view and clears the filters while keeping search and sort", async () => {
      const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));
      openOnUrl(`sort=${sort}&family=ambyte,multispeq&visibility=private`);
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.protocols.listProtocols, {
        body: envelope([createProtocol({ id: "1", name: "Shared" })]),
      });

      render(<ListProtocols />);

      expect(
        screen.getByRole("button", { name: /^protocols\.columns\.family(?!:)/ }),
      ).toHaveTextContent("2");
      expect(screen.getByRole("button", { name: /protocols\.visibility/ })).toHaveTextContent("1");
      await waitFor(() => expect(screen.getByRole("link", { name: "Shared" })).toBeInTheDocument());
      expect(spy.calls.at(-1)?.url).toContain("family%5B1%5D=multispeq");
      expect(spy.calls.at(-1)?.url).toContain("visibility%5B0%5D=private");

      await user.type(screen.getByPlaceholderText("protocols.searchProtocols"), "fluor");
      await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("fluor"));
      await user.click(screen.getByRole("button", { name: "common.clearFilters" }));

      const [url] = replace.mock.lastCall ?? [];
      expect(url).toContain("sort=");
      expect(url).not.toContain("family");
      expect(url).not.toContain("visibility");
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).not.toContain("family");
      });
      expect(spy.calls.at(-1)?.query.search).toBe("fluor");
      expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name");
    });

    it("offers to clear the filters when nothing matches them", async () => {
      openOnUrl("family=ambit");
      const user = userEvent.setup();
      server.mount(contract.protocols.listProtocols, { body: envelope([]) });

      render(<ListProtocols />);

      await waitFor(() =>
        expect(screen.getByText("protocols.noFilterMatches")).toBeInTheDocument(),
      );
      const clearButtons = screen.getAllByRole("button", { name: "common.clearFilters" });
      expect(clearButtons).toHaveLength(2);

      await user.click(clearButtons[1]);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
      });
      await waitFor(() => expect(screen.getByText("protocols.noProtocols")).toBeInTheDocument());
    });
  });
});
