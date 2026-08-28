import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

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
        status: "archived",
      });
    });
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
});
