import { render, screen, userEvent } from "@/test/test-utils";
import { Eye } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ListFilter } from "@repo/ui/components/list-filter-menu";

import type { ResourceListModel } from "./resource-list";
import { ResourceList } from "./resource-list";

interface Row {
  id: string;
  name: string;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));

function makeList(overrides: Partial<ResourceListModel<Row, "name">> = {}) {
  const list: ResourceListModel<Row, "name"> = {
    data: { items: rows(2), page: 1, pageSize: 20, totalPages: 1, totalCount: 2 },
    isLoading: false,
    isPlaceholderData: false,
    isSearchPending: false,
    error: null,
    refetch: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    debouncedSearch: "",
    page: 1,
    setPage: vi.fn(),
    sort: [],
    setSort: vi.fn(),
    toggleSort: vi.fn(),
    hasActiveFilters: false,
    clearFilters: vi.fn(),
    ...overrides,
  };
  return list;
}

function visibilityFilter(selected: string[] = []): ListFilter {
  return {
    key: "visibility",
    label: "Visibility",
    icon: Eye,
    options: [
      { value: "private", label: "Private" },
      { value: "public", label: "Public" },
    ],
    selected,
    onChange: vi.fn(),
  };
}

function renderList(list = makeList(), filters: ListFilter[] = [visibilityFilter()]) {
  render(
    <ResourceList
      list={list}
      filters={filters}
      searchInput={{
        placeholder: "Search rows",
        clearLabel: "Clear search",
        loadingLabel: "Loading rows",
      }}
      columns={[
        { header: "Name", sortId: "name", cell: (row: Row, href) => <a href={href}>{row.name}</a> },
      ]}
      getRowKey={(row) => row.id}
      getRowHref={(row) => `/rows/${row.id}`}
      errorMessage="Rows failed to load"
      emptyMessages={{ filtered: "No row matches", searched: "No search match", empty: "No rows" }}
      emptyHelpPath="/guide/rows"
    />,
  );
  return list;
}

describe("ResourceList", () => {
  it("renders the rows as links", () => {
    renderList();

    expect(screen.getByRole("link", { name: "Row 0" })).toHaveAttribute("href", "/rows/r0");
  });

  it("sends typing to the search", async () => {
    const user = userEvent.setup();
    const list = renderList();

    await user.type(screen.getByPlaceholderText("Search rows"), "w");

    expect(list.setSearch).toHaveBeenCalledWith("w");
  });

  it("offers Reset sorting only while a sort is active", async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();

    const sorted = makeList({ sort: [{ field: "name", direction: "asc" }] });
    renderList(sorted);
    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));

    expect(sorted.setSort).toHaveBeenCalledWith([]);
  });

  it("sorts from a column heading", async () => {
    const user = userEvent.setup();
    const list = renderList();

    await user.click(screen.getByRole("button", { name: /Name/ }));

    expect(list.toggleSort).toHaveBeenCalledWith("name", false);
  });

  it("shows the chip row only while a filter is active", async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.queryByRole("group", { name: /common\.filterChip/ })).toBeNull();

    const filtered = makeList({ hasActiveFilters: true });
    renderList(filtered, [visibilityFilter(["public"])]);
    expect(
      screen.getByRole("group", { name: "common.filterChip:Visibility:Public" }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "common.clearFilters" })[0]);

    expect(filtered.clearFilters).toHaveBeenCalled();
  });

  it("explains an empty list by filters first, then search, with a way out of the filters", async () => {
    const user = userEvent.setup();
    const empty = { items: [], page: 1, pageSize: 20, totalPages: 1, totalCount: 0 };
    const list = makeList({
      data: empty,
      hasActiveFilters: true,
      debouncedSearch: "wheat",
    });
    renderList(list, [visibilityFilter(["public"])]);

    expect(screen.getByText("No row matches")).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: "common.clearFilters" });
    expect(clearButtons).toHaveLength(2);
    await user.click(clearButtons[1]);
    expect(list.clearFilters).toHaveBeenCalled();
    expect(document.querySelector('a[href*="/guide/rows"]')).toBeNull();
  });

  it("explains an empty search, then an empty collection with its help link", () => {
    const empty = { items: [], page: 1, pageSize: 20, totalPages: 1, totalCount: 0 };
    renderList(makeList({ data: empty, debouncedSearch: "  wheat " }));
    expect(screen.getByText("No search match")).toBeInTheDocument();
    expect(document.querySelector('a[href*="/guide/rows"]')).toBeNull();

    renderList(makeList({ data: empty, debouncedSearch: "  " }));
    expect(screen.getByText("No rows")).toBeInTheDocument();
    expect(document.querySelector('a[href*="/guide/rows"]')).not.toBeNull();
  });

  it("pages only when there are rows", async () => {
    const user = userEvent.setup();
    const list = makeList({
      data: { items: rows(20), page: 1, pageSize: 20, totalPages: 2, totalCount: 40 },
    });
    renderList(list);

    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(list.setPage).toHaveBeenCalledWith(2);

    const empty = { items: [], page: 1, pageSize: 20, totalPages: 1, totalCount: 0 };
    renderList(makeList({ data: empty }));
    expect(screen.getAllByRole("button", { name: "pagination.next" })).toHaveLength(1);
  });

  it("dims and locks the rows while the next ones load", () => {
    renderList(makeList({ isPlaceholderData: true }));

    const wrapper = screen.getByRole("table").closest("[aria-busy]");
    expect(wrapper).toHaveAttribute("aria-busy", "true");
    expect(wrapper).toHaveAttribute("inert");
  });

  it("retries a failed load", async () => {
    const user = userEvent.setup();
    const list = makeList({ data: undefined, error: new Error("boom") });
    renderList(list);

    expect(screen.getByText("Rows failed to load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));

    expect(list.refetch).toHaveBeenCalled();
  });

  it("shows the search spinner while a search is pending", () => {
    renderList(makeList({ search: "wh", isSearchPending: true }));

    expect(screen.getByLabelText("Loading rows")).toBeInTheDocument();
  });
});
