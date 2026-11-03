import { createExperiment } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListExperiments } from "../list-experiments";

const helpLink = () => document.querySelector('a[href*="/guide/get-started/quick-start"]');

async function openFilterRow(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "common.filter" }));
  await user.click(screen.getByRole("option", { name }));
  return { user, values: screen.getByRole("listbox", { name }) };
}

const optionTexts = (root: HTMLElement) =>
  within(root)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("ListExperiments", () => {
  it("has no create, archive, transfer links or my/all toggle", () => {
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);

    expect(screen.queryByRole("link", { name: "experiments.create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "experiments.viewArchived" })).toBeNull();
    expect(screen.queryByRole("link", { name: "transferRequest.title" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("focuses the search when the link asks for it", () => {
    openOnUrl("/platform/experiments", "focus=search");
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);

    expect(screen.getByPlaceholderText("experiments.searchExperiments")).toHaveFocus();
  });

  it("leaves focus alone on a plain visit", () => {
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);

    expect(screen.getByPlaceholderText("experiments.searchExperiments")).not.toHaveFocus();
  });

  it("links rows to their detail pages", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: listEnvelope([createExperiment({ id: "1", name: "Exp 1" })]),
    });

    render(<ListExperiments />);

    const link = await screen.findByRole("link", { name: "Exp 1" });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments/1");
  });

  it("offers status and visibility filters with their value labels", async () => {
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });
    render(<ListExperiments />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "filters.status",
      "filters.visibility",
    ]);
    await user.click(screen.getByRole("option", { name: "filters.visibility" }));
    expect(optionTexts(screen.getByRole("listbox", { name: "filters.visibility" }))).toEqual([
      "visibility.private",
      "visibility.public",
    ]);
  });

  it("lists statuses without archived and filters through the URL and API", async () => {
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });
    render(<ListExperiments />);

    const { user, values } = await openFilterRow("filters.status");
    expect(optionTexts(values)).toEqual(["status.active", "status.stale", "status.published"]);
    await user.click(within(values).getByRole("option", { name: "status.stale" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/experiments?status=stale", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "status")).toEqual(["stale"]),
    );
    expect(
      screen.getByRole("group", { name: "common.filterChip:filters.status:status.stale" }),
    ).toBeInTheDocument();
  });

  it("shows the empty message and help link", async () => {
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);

    expect(await screen.findByText("experiments.noExperiments")).toBeInTheDocument();
    expect(helpLink()).toBeInTheDocument();
  });

  it("shows the search message", async () => {
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText("experiments.searchExperiments"), "missing");

    expect(await screen.findByText("experiments.noMatches")).toBeInTheDocument();
  });

  it("shows the filtered message", async () => {
    openOnUrl("/platform/experiments", "visibility=private");
    server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    render(<ListExperiments />);

    expect(await screen.findByText("experiments.noFilterMatches")).toBeInTheDocument();
  });

  describe("archived", () => {
    it("offers only the visibility filter", async () => {
      server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });
      render(<ListExperiments archived />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "common.filter" }));
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "filters.visibility",
      ]);
    });

    it("links rows to the archive detail page", async () => {
      server.mount(contract.experiments.listExperiments, {
        body: listEnvelope([createExperiment({ id: "1", name: "Old Exp" })]),
      });

      render(<ListExperiments archived />);

      const link = await screen.findByRole("link", { name: "Old Exp" });
      expect(link).toHaveAttribute("href", "/en-US/platform/experiments-archive/1");
    });

    it("shows the empty message without a help link", async () => {
      server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

      render(<ListExperiments archived />);

      expect(await screen.findByText("experiments.noExperiments")).toBeInTheDocument();
      expect(helpLink()).toBeNull();
    });
  });
});
