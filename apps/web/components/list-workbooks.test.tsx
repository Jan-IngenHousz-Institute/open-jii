import { OPEN_WORKBOOK_CREATE_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { ListWorkbooks } from "./list-workbooks";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

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

  it("renders the search input without a my/all filter toggle", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    render(<ListWorkbooks />);

    expect(screen.getByPlaceholderText("workbooks.searchPlaceholder")).toBeInTheDocument();
    expect(screen.queryByText("workbooks.filterWorkbooks")).not.toBeInTheDocument();
  });

  it("renders the collection empty state and docs help link without a search", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    render(<ListWorkbooks />);

    expect(await screen.findByText("workbooks.noWorkbooks")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toContain("/guide/experiments/workbooks");
  });

  it("distinguishes a search with no matches from an empty workbook collection", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await screen.findByText("workbooks.noWorkbooks");
    await user.type(screen.getByPlaceholderText("workbooks.searchPlaceholder"), "missing");

    expect(await screen.findByText("workbooks.noMatches")).toBeInTheDocument();
    expect(screen.queryByText("workbooks.noWorkbooks")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders workbooks as table rows linking to their detail pages", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];
    server.mount(contract.workbooks.listWorkbooks, { body: envelope(workbooks) });

    render(<ListWorkbooks />);

    const link = await screen.findByRole("link", { name: "Test WB" });
    expect(link.getAttribute("href")).toContain("/platform/workbooks/wb-1");
  });

  it("navigates pages when the server reports more than one page", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, {
      body: (call: { query: Record<string, string> }) =>
        envelope([createWorkbook({ id: "wb-1", name: "Test WB" })], Number(call.query.page), 2),
    });
    const user = userEvent.setup();

    render(<ListWorkbooks />);

    await user.click(await screen.findByRole("button", { name: "pagination.next" }));
    await waitFor(() => expect(spy.calls.at(-1)?.query.page).toBe("2"));
  });

  it("keeps pagination visible and disabled when the server reports one page", async () => {
    server.mount(contract.workbooks.listWorkbooks, {
      body: envelope([createWorkbook({ id: "wb-1", name: "Test WB" })]),
    });

    render(<ListWorkbooks />);

    expect(await screen.findByRole("link", { name: "Test WB" })).toBeVisible();
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("shows clear button when search has value", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "test");

    expect(await screen.findByLabelText("workbooks.clearSearch")).toBeInTheDocument();
  });

  it("clears the search via the clear button", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "wheat");
    await user.click(await screen.findByLabelText("workbooks.clearSearch"));

    expect(searchInput).toHaveValue("");
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

  it("shows a recoverable error when the list request fails", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, { status: 500 });
    const user = userEvent.setup();
    render(<ListWorkbooks />);

    expect(await screen.findByText("workbooks.errorLoading")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.errors.tryAgain" }));
    await waitFor(() => expect(spy.callCount).toBeGreaterThan(1));
  });
});
