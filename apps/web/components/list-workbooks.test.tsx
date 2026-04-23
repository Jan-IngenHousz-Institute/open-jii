import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ListWorkbooks } from "./list-workbooks";

// Mock WorkbookOverviewCards to keep test focused
vi.mock("~/components/workbook-overview-cards", () => ({
  WorkbookOverviewCards: ({
    workbooks,
    isLoading,
  }: {
    workbooks: { id: string; name: string }[] | undefined;
    isLoading: boolean;
  }) => (
    <div data-testid="workbook-cards">
      {isLoading && <span>Loading...</span>}
      {workbooks?.map((w) => <span key={w.id}>{w.name}</span>)}
    </div>
  ),
}));

describe("ListWorkbooks", () => {
  it("renders search input and filter selector", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ListWorkbooks />);

    expect(screen.getByPlaceholderText("workbooks.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("workbooks.filterMy")).toBeInTheDocument();
  });

  it("passes workbooks data to cards", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];
    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });

    render(<ListWorkbooks />);

    await waitFor(() => {
      expect(screen.getByText("Test WB")).toBeInTheDocument();
    });
  });

  it("shows clear button when search has value", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const user = userEvent.setup();
    render(<ListWorkbooks />);

    const searchInput = screen.getByPlaceholderText("workbooks.searchPlaceholder");
    await user.type(searchInput, "test");

    expect(screen.getByLabelText("workbooks.clearSearch")).toBeInTheDocument();
  });
});
