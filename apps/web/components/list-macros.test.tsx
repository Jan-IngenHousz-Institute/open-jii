import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { getMacroLanguageLabel } from "~/util/macro-language";

import { contract } from "@repo/api/contract";
import { zMacroLanguage } from "@repo/api/domains/macro/macro.schema";

import { ListMacros } from "./list-macros";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

async function openFilter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^common\.filter/ }));
  await user.click(screen.getByRole("option", { name }));
  return screen.getByRole("listbox", { name });
}

const chipLabels = () =>
  screen
    .queryAllByRole("group", { name: /common\.filterIs/ })
    .map((chip) => chip.getAttribute("aria-label"));

describe("ListMacros", () => {
  it("keeps the filters with search and route-wide create out of the toolbar", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: envelope([]) });
    render(<ListMacros />);

    const toolbar = screen
      .getByPlaceholderText("macros.searchPlaceholder")
      .closest("div.flex.flex-col");
    expect(toolbar).toContainElement(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.queryByRole("link", { name: "macros.create" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "macros.columns.language",
      "macros.visibility",
    ]);
  });

  it("renders search input and both filters, but no language dropdown or my/all toggle", async () => {
    server.mount(contract.macros.listMacros, { body: envelope([]) });
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("macros.allLanguages")).toBeNull();
    expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    await screen.findByText("macros.noMacros");
    expect(screen.queryByText("macros.filterMacros")).not.toBeInTheDocument();
  });

  it("renders macros as table rows linking to their detail pages", async () => {
    server.mount(contract.macros.listMacros, {
      body: envelope([createMacro({ id: "1", name: "M1" })]),
    });
    render(<ListMacros />);

    const link = await screen.findByRole("link", { name: "M1" });
    expect(link.getAttribute("href")).toContain("/platform/macros/1");
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("sends search query to the API", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListMacros />);

    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "test");

    await waitFor(() => {
      const lastCall = spy.calls[spy.calls.length - 1];
      expect(lastCall.query.search).toBe("test");
    });
  });

  it("distinguishes a search with no matches from an empty macro collection", async () => {
    server.mount(contract.macros.listMacros, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListMacros />);

    await screen.findByText("macros.noMacros");
    await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "missing");

    expect(await screen.findByText("macros.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("macros.noMacros")).not.toBeInTheDocument();
  });

  it("navigates pages via the pagination controls", async () => {
    const spy = server.mount(contract.macros.listMacros, {
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

  it("sorts by name, adds a secondary field, and resets", async () => {
    const spy = server.mount(contract.macros.listMacros, {
      body: envelope([createMacro({ id: "1", name: "First" })]),
    });
    const user = userEvent.setup();
    render(<ListMacros />);

    await screen.findByRole("link", { name: "First" });
    expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
    expect(screen.queryByRole("button", { name: /macros.columns.activity:/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /macros.columns.name:/ }));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name"));

    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /macros.columns.language:/ }));
    await user.keyboard("{/Shift}");
    expect(
      screen.getByRole("button", { name: /macros.columns.language:.*common.sortSecondary/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[1][field]"]).toBe("language"));

    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    await waitFor(() => expect(spy.calls.at(-1)?.query.sort).toBeUndefined());
  });

  describe("language and visibility filters", () => {
    function openOnUrl(qs: string) {
      vi.mocked(nav.usePathname).mockReturnValue("/platform/macros");
      vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
    }

    it("lists the three languages and filters through the URL and the API", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

      render(<ListMacros />);
      const languages = await openFilter(user, "macros.columns.language");

      expect(
        within(languages)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(zMacroLanguage.options.map(getMacroLanguageLabel));
      await user.click(within(languages).getByRole("option", { name: "Python" }));

      expect(replace).toHaveBeenLastCalledWith("/platform/macros?language=python", {
        scroll: false,
      });
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).toContain("language%5B0%5D=python");
      });
      expect(chipLabels()).toEqual(["macros.columns.language common.filterIs Python"]);
    });

    it("lists both visibilities and filters by one", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

      render(<ListMacros />);
      const visibilities = await openFilter(user, "macros.visibility");

      expect(
        within(visibilities)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["macros.private", "macros.public"]);
      await user.click(within(visibilities).getByRole("option", { name: "macros.private" }));

      expect(replace).toHaveBeenLastCalledWith("/platform/macros?visibility=private", {
        scroll: false,
      });
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).toContain("visibility%5B0%5D=private");
      });
    });

    it("restores a shared view and clears the filters while keeping search and sort", async () => {
      const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));
      openOnUrl(`sort=${sort}&language=python,r&visibility=public`);
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = server.mount(contract.macros.listMacros, {
        body: envelope([createMacro({ id: "1", name: "Shared" })]),
      });

      render(<ListMacros />);

      expect(chipLabels()).toEqual([
        "macros.columns.language common.filterIs Python",
        "macros.columns.language common.filterIs R",
        "macros.visibility common.filterIs macros.public",
      ]);
      await waitFor(() => expect(screen.getByRole("link", { name: "Shared" })).toBeInTheDocument());
      expect(spy.calls.at(-1)?.url).toContain("language%5B1%5D=r");
      expect(spy.calls.at(-1)?.url).toContain("visibility%5B0%5D=public");

      await user.type(screen.getByPlaceholderText("macros.searchPlaceholder"), "anova");
      await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("anova"));
      await user.click(screen.getByRole("button", { name: "common.clearFilters" }));

      const [url] = replace.mock.lastCall ?? [];
      expect(url).toContain("sort=");
      expect(url).not.toContain("language");
      expect(url).not.toContain("visibility");
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).not.toContain("language");
      });
      expect(spy.calls.at(-1)?.query.search).toBe("anova");
      expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name");
    });

    it("offers to clear the filters when nothing matches them", async () => {
      openOnUrl("language=r");
      const user = userEvent.setup();
      server.mount(contract.macros.listMacros, { body: envelope([]) });

      render(<ListMacros />);

      await waitFor(() => expect(screen.getByText("macros.noFilterMatches")).toBeInTheDocument());
      const clearButtons = screen.getAllByRole("button", { name: "common.clearFilters" });
      expect(clearButtons).toHaveLength(2);

      await user.click(clearButtons[1]);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
      });
      await waitFor(() => expect(screen.getByText("macros.noMacros")).toBeInTheDocument());
    });
  });
});
