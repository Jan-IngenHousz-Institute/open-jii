import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { ListWorkbooks } from "./list-workbooks";

// Mock WorkbookList to keep test focused
vi.mock("~/components/workbook-list", () => ({
  WorkbookList: ({
    workbooks,
    isLoading,
  }: {
    workbooks: { id: string; name: string }[] | undefined;
    isLoading: boolean;
  }) => (
    <div data-testid="workbook-list">
      {isLoading && <span>Loading...</span>}
      {workbooks?.map((w) => <span key={w.id}>{w.name}</span>)}
    </div>
  ),
}));

describe("ListWorkbooks", () => {
  it("renders search input and filter selector", () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });

    render(<ListWorkbooks />);

    expect(screen.getByPlaceholderText("workbooks.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("workbooks.filterMy")).toBeInTheDocument();
  });

  it("passes workbooks data to cards", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];
    server.mount(orpcContract.workbooks.listWorkbooks, { body: workbooks });

    render(<ListWorkbooks />);

    await waitFor(() => {
      expect(screen.getByText("Test WB")).toBeInTheDocument();
    });
  });

  it("shows clear button when search has value", async () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "test");

    expect(screen.getByLabelText("workbooks.clearSearch")).toBeInTheDocument();
  });

  it("clears the search via the clear button", async () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "wheat");
    await user.click(screen.getByLabelText("workbooks.clearSearch"));

    expect(searchInput).toHaveValue("");
  });

  it("closes the create dialog via the Cancel button", async () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });

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
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    await user.type(await screen.findByPlaceholderText("workbooks.namePlaceholder"), "Draft");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "workbooks.create" }));
    expect(await screen.findByPlaceholderText("workbooks.namePlaceholder")).toHaveValue("");
  });

  it("creates a workbook with the entered name from the dialog", async () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });
    const spy = server.mount(orpcContract.workbooks.createWorkbook, {
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

  it("does not create a workbook when the name is blank", async () => {
    server.mount(orpcContract.workbooks.listWorkbooks, { body: [] });
    const spy = server.mount(orpcContract.workbooks.createWorkbook, {
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
