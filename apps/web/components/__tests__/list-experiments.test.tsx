import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListExperiments } from "../list-experiments";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("ListExperiments", () => {
  it("keeps only collection-local controls beside the experiment list", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    expect(screen.getByPlaceholderText("experiments.searchExperiments")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "experiments.create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "experiments.viewArchived" })).toBeNull();
    expect(screen.queryByRole("link", { name: "transferRequest.title" })).toBeNull();
  });

  it("focuses the search when the link asks for it", () => {
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams("visibility=public&focus=search"),
    );
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    expect(screen.getByPlaceholderText("experiments.searchExperiments")).toHaveFocus();
  });

  it("leaves focus alone on a plain visit", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    expect(screen.getByPlaceholderText("experiments.searchExperiments")).not.toHaveFocus();
  });

  it("renders experiments as table rows linking to their detail pages", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });

    render(<ListExperiments />);

    const link = await screen.findByRole("link", { name: "Exp 1" });
    expect(link.getAttribute("href")).toBe("/en-US/platform/experiments/1");
  });

  it("links to the archive detail page when archived", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Old Exp" })]),
    });

    render(<ListExperiments archived />);

    const link = await screen.findByRole("link", { name: "Old Exp" });
    expect(link.getAttribute("href")).toBe("/en-US/platform/experiments-archive/1");
  });

  it("renders the empty state with a docs help link when no experiments", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    await waitFor(() => {
      expect(screen.getByText("experiments.noExperiments")).toBeInTheDocument();
    });
    expect(document.querySelector('a[href*="/guide/get-started/quick-start"]')).toBeInTheDocument();
  });

  it("distinguishes a search with no matches from an empty experiment collection", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments />);

    await screen.findByText("experiments.noExperiments");
    await user.type(screen.getByPlaceholderText("experiments.searchExperiments"), "missing");

    expect(await screen.findByText("experiments.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("experiments.noExperiments")).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="/guide/get-started/quick-start"]')).toBeNull();
  });

  it("keeps the search empty state while a cleared query is still debouncing", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    await user.type(input, "missing");
    await screen.findByText("experiments.noMatches");

    await user.clear(input);
    expect(screen.getByText("experiments.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("experiments.noExperiments")).not.toBeInTheDocument();

    expect(await screen.findByText("experiments.noExperiments")).toBeInTheDocument();
  });

  it("uses the search-specific empty state in the experiment archive", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments archived />);

    await screen.findByText("experiments.noExperiments");
    await user.type(screen.getByPlaceholderText("experiments.searchExperiments"), "missing");

    expect(await screen.findByText("experiments.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("experiments.noExperiments")).not.toBeInTheDocument();
  });

  it("does not render a my/all filter toggle", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    await screen.findByText("experiments.noExperiments");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("updates search on input change", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    await user.type(input, "abc");

    expect(input).toHaveValue("abc");
  });

  it("shows search-specific pending feedback during the debounce", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments />);
    await screen.findByText("experiments.noExperiments");

    await user.type(screen.getByPlaceholderText("experiments.searchExperiments"), "abc");

    expect(
      screen.getByRole("status", { name: "experiments.loadingExperiments" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experiments.clearSearch" }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button when search is active and clears on click", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    await user.type(input, "abc");
    expect(input).toHaveValue("abc");

    await user.click(await screen.findByRole("button", { name: "experiments.clearSearch" }));
    expect(input).toHaveValue("");
  });

  it("shows pagination when there is more than one page and navigates", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createExperiment({ id: "1", name: "Exp 1" })], Number(call.query.page), 3),
    });

    const user = userEvent.setup();
    render(<ListExperiments />);

    const next = await screen.findByRole("button", { name: "pagination.next" });
    await user.click(next);

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("keeps pagination available in the archive", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createExperiment({ id: "old-1", name: "Old Exp" })], Number(call.query.page), 2),
    });

    const user = userEvent.setup();
    render(<ListExperiments archived />);

    await user.click(await screen.findByRole("button", { name: "pagination.next" }));

    await waitFor(() => {
      expect(spy.calls.at(-1)?.query).toMatchObject({
        page: "2",
        scope: "related",
        "status[0]": "archived",
      });
    });
  });

  it("sorts through the API, adds a secondary field, and resets", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });
    const user = userEvent.setup();
    render(<ListExperiments />);

    await screen.findByRole("link", { name: "Exp 1" });
    expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /columns.name:/ }));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name"));
    expect(screen.getByRole("button", { name: /columns.name:/ }).closest("th")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /columns.status:/ }));
    await user.keyboard("{/Shift}");
    expect(
      screen.getByRole("button", { name: /columns.status:.*common.sortSecondary/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /columns.status:/ }).closest("th"),
    ).not.toHaveAttribute("aria-sort");

    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    await waitFor(() => expect(spy.calls.at(-1)?.query.sort).toBeUndefined());
  });

  it("restores a shared sort URL in the archive", async () => {
    const nav = await import("next/navigation");
    const raw = encodeURIComponent(JSON.stringify([{ field: "updated", direction: "desc" }]));
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(`sort=${raw}`));
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "old-1", name: "Old Exp" })]),
    });
    render(<ListExperiments archived />);

    await screen.findByRole("link", { name: "Old Exp" });
    expect(spy.calls.at(-1)?.query).toMatchObject({
      "status[0]": "archived",
      "sort[0][field]": "updated",
      "sort[0][direction]": "desc",
    });
    expect(screen.getByRole("button", { name: "common.resetSorting" })).toBeInTheDocument();
  });

  it("hides pagination when the collection is empty", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    await screen.findByText("experiments.noExperiments");
    expect(screen.queryByRole("button", { name: "pagination.next" })).not.toBeInTheDocument();
  });

  it("keeps pagination visible and disabled when one page has rows", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });

    render(<ListExperiments />);

    await waitFor(() => expect(screen.getByRole("link", { name: "Exp 1" })).toBeVisible());
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("makes the stale page non-interactive while the next page loads", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createExperiment({ id: "1", name: "Exp 1" })], Number(call.query.page), 3),
    });

    const user = userEvent.setup();
    const { container } = render(<ListExperiments />);

    await screen.findByRole("link", { name: "Exp 1" });

    let releasePage2!: () => void;
    const gate = new Promise<void>((resolve) => {
      releasePage2 = resolve;
    });
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "2", name: "Exp 2" })], 2, 3),
      unblock: gate,
    });

    await user.click(screen.getByRole("button", { name: "pagination.next" }));

    const busy = await waitFor(() => {
      const el = container.querySelector('[aria-busy="true"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(busy).toHaveAttribute("inert");
    expect(busy.className).toContain("pointer-events-none");
    expect(busy.className).not.toContain("transition-opacitypointer-events-none");
    expect(busy.querySelector("a")).toHaveTextContent("Exp 1");

    releasePage2();
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });
  });

  it("offers status and visibility filters on the main list", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    expect(screen.getByRole("button", { name: "filters.status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "filters.visibility" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
  });

  it("offers only the visibility filter in the archive", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments archived />);

    expect(screen.queryByRole("button", { name: /filters\.status/ })).toBeNull();
    expect(screen.getByRole("button", { name: /filters\.visibility/ })).toBeInTheDocument();
  });

  it("lists the statuses without archived and filters through the API", async () => {
    const user = userEvent.setup();
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);
    await user.click(screen.getByRole("button", { name: "filters.status" }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "status.active",
      "status.stale",
      "status.published",
    ]);
    await user.click(screen.getByRole("option", { name: "status.stale" }));

    expect(replace).toHaveBeenLastCalledWith("/platform/experiments?status=stale", {
      scroll: false,
    });
    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1].url).toContain("status%5B0%5D=stale");
    });
    expect(screen.getByRole("button", { name: /filters\.status/ })).toHaveTextContent("1");
  });

  it("restores shared filters and clears them from the toolbar", async () => {
    const user = userEvent.setup();
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams("status=active,stale&visibility=public"),
    );
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });

    render(<ListExperiments />);

    expect(screen.getByRole("button", { name: /filters\.status/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /filters\.visibility/ })).toHaveTextContent("1");
    await screen.findByRole("link", { name: "Exp 1" });

    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));

    expect(replace).toHaveBeenLastCalledWith("/platform/experiments", { scroll: false });
    expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
  });

  it("offers to clear the filters when nothing matches them", async () => {
    const user = userEvent.setup();
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams("visibility=private"),
    );
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<ListExperiments />);

    await screen.findByText("experiments.noFilterMatches");
    expect(document.querySelector('a[href*="/guide/get-started/quick-start"]')).toBeNull();
    const clearButtons = screen.getAllByRole("button", { name: "common.clearFilters" });
    expect(clearButtons).toHaveLength(2);

    await user.click(clearButtons[1]);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });
  });

  it("retries after a failed load", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperiments, { status: 500 });

    render(<ListExperiments />);

    const retry = await screen.findByRole("button", { name: "common.errors.tryAgain" });
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });
    await user.click(retry);

    // Re-queried on each attempt: the rows can re-render after the first match, which detaches it.
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Exp 1" })).toBeInTheDocument();
    });
  });
});
