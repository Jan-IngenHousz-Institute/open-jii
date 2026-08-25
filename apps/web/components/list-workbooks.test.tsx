import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
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

describe("ListWorkbooks", () => {
  it("renders the search input without a my/all filter toggle", () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    render(<ListWorkbooks />);

    expect(screen.getByPlaceholderText("workbooks.searchPlaceholder")).toBeInTheDocument();
    expect(screen.queryByText("workbooks.filterWorkbooks")).not.toBeInTheDocument();
  });

  it("renders workbooks as table rows linking to their detail pages", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope(workbooks) });

    render(<ListWorkbooks />);

    const link = await screen.findByRole("link", { name: "Test WB" });
    expect(link.getAttribute("href")).toContain("/platform/workbooks/wb-1");
  });

  it("shows clear button when search has value", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "test");

    expect(screen.getByLabelText("workbooks.clearSearch")).toBeInTheDocument();
  });

  it("clears the search via the clear button", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "wheat");
    await user.click(screen.getByLabelText("workbooks.clearSearch"));

    expect(searchInput).toHaveValue("");
  });

  it("closes the create dialog via the Cancel button", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    expect(await screen.findByText("workbooks.createDescription")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "workbooks.cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("workbooks.createDescription")).not.toBeInTheDocument(),
    );
  });

  it("resets the name field when the dialog is dismissed", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    await user.type(await screen.findByPlaceholderText("workbooks.namePlaceholder"), "Draft");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    expect(await screen.findByPlaceholderText("workbooks.namePlaceholder")).toHaveValue("");
  });

  it("creates a workbook with the entered name from the dialog", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "wb-new", name: "My New WB" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    const nameInput = await screen.findByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "  My New WB  {Enter}");

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "My New WB" });
  });

  it("gives the visibility select an accessible name", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));

    // A placeholder is not an accessible name: the control needs a real label,
    // like the macro and protocol create forms have.
    expect(
      await screen.findByRole("combobox", { name: "workbooks.visibility" }),
    ).toBeInTheDocument();
  });

  it("creates a private workbook when private is picked", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "wb-new", name: "Private WB", visibility: "private" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    await user.click(await screen.findByRole("combobox", { name: "workbooks.visibility" }));
    await user.click(screen.getByRole("option", { name: "workbooks.private" }));

    const nameInput = screen.getByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "Private WB{Enter}");

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Private WB", visibility: "private" });
  });

  it("does not create a workbook when the name is blank", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "x" }),
    });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    const nameInput = await screen.findByPlaceholderText("workbooks.namePlaceholder");
    await user.type(nameInput, "   {Enter}");

    expect(spy.called).toBe(false);
  });
});
