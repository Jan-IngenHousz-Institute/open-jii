import { OPEN_WORKBOOK_CREATE_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { createWorkbook } from "@/test/factories";
import { arrayParam, listEnvelope as envelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, render, screen, waitFor, userEvent, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ListWorkbooks } from "./list-workbooks";

function openCreateDialog() {
  return act(() => {
    window.dispatchEvent(new Event(OPEN_WORKBOOK_CREATE_EVENT));
  });
}

describe("ListWorkbooks", () => {
  it("opens create from the contextual header event instead of a collection-toolbar button", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    render(<ListWorkbooks />);

    expect(screen.getByPlaceholderText("workbooks.searchPlaceholder")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "workbooks.create" })).toBeNull();

    openCreateDialog();
    expect(await screen.findByText("workbooks.createDescription")).toBeInTheDocument();
  });

  it("renders workbooks as table rows linking to their detail pages", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];
    server.mount(contract.workbooks.listWorkbooks, { body: envelope(workbooks) });

    render(<ListWorkbooks />);

    const link = await screen.findByRole("link", { name: "Test WB" });
    expect(link.getAttribute("href")).toContain("/platform/workbooks/wb-1");
  });

  it("closes the create dialog via the Cancel button", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    openCreateDialog();
    expect(await screen.findByText("workbooks.createDescription")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "workbooks.cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("workbooks.createDescription")).not.toBeInTheDocument(),
    );
  });

  it("resets the name field when the dialog is dismissed", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    openCreateDialog();
    await user.type(await screen.findByPlaceholderText("workbooks.namePlaceholder"), "Draft");
    await user.keyboard("{Escape}");

    openCreateDialog();
    expect(await screen.findByPlaceholderText("workbooks.namePlaceholder")).toHaveValue("");
  });

  it("creates a workbook with the entered name from the dialog", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "wb-new", name: "My New WB" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    openCreateDialog();
    const nameInput = await screen.findByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "  My New WB  {Enter}");

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "My New WB" });
  });

  it("gives the visibility select an accessible name", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    render(<ListWorkbooks />);

    openCreateDialog();

    // A placeholder is not an accessible name: the control needs a real label,
    // like the macro and protocol create forms have.
    expect(
      await screen.findByRole("combobox", { name: "workbooks.visibility" }),
    ).toBeInTheDocument();
  });

  it("creates a private workbook when private is picked", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "wb-new", name: "Private WB", visibility: "private" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    openCreateDialog();
    await user.click(await screen.findByRole("combobox", { name: "workbooks.visibility" }));
    await user.click(screen.getByRole("option", { name: "workbooks.private" }));

    const nameInput = screen.getByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "Private WB{Enter}");

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Private WB", visibility: "private" });
  });

  it("does not create a workbook when the name is blank", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "x" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    openCreateDialog();
    const nameInput = await screen.findByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "   {Enter}");

    expect(spy.called).toBe(false);
  });

  it("shows the collection empty state with the workbooks help link", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    render(<ListWorkbooks />);

    expect(await screen.findByText("workbooks.noWorkbooks")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toContain("/guide/experiments/workbooks");
  });

  it("uses the workbook message for a search with no matches", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    const user = userEvent.setup();
    render(<ListWorkbooks />);
    await user.type(screen.getByPlaceholderText("workbooks.searchPlaceholder"), "missing");

    expect(await screen.findByText("workbooks.noMatches")).toBeInTheDocument();
  });

  it("uses the workbook message for a filter with no matches", async () => {
    openOnUrl("/platform/workbooks", "visibility=private");
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    render(<ListWorkbooks />);

    expect(await screen.findByText("workbooks.noFilterMatches")).toBeInTheDocument();
  });

  it("filters by visibility through the URL and the API", async () => {
    openOnUrl("/platform/workbooks", "");
    const user = userEvent.setup();
    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: /^common\.filter/ }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "workbooks.visibility",
    ]);
    await user.click(screen.getByRole("option", { name: "workbooks.visibility" }));
    const values = screen.getByRole("listbox", { name: "workbooks.visibility" });
    expect(
      within(values)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["workbooks.private", "workbooks.public"]);
    await user.click(within(values).getByRole("option", { name: "workbooks.private" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("/platform/workbooks?visibility=private", {
      scroll: false,
    });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "visibility")).toEqual(["private"]),
    );
    expect(
      screen.getByRole("group", {
        name: "common.filterChip:workbooks.visibility:workbooks.private",
      }),
    ).toBeInTheDocument();
  });
});
