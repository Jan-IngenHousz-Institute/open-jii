import { createMacroCell, createProtocolCell, createWorkbook } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { WorkbookOverviewCards } from "./workbook-overview-cards";

describe("WorkbookOverviewCards", () => {
  it("shows loading skeletons when isLoading is true", () => {
    render(<WorkbookOverviewCards workbooks={undefined} isLoading={true} />);

    const skeletons = document.querySelectorAll(".h-48");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty message when no workbooks exist", () => {
    render(<WorkbookOverviewCards workbooks={[]} isLoading={false} />);

    expect(screen.getByText("workbooks.noWorkbooks")).toBeInTheDocument();
  });

  it("shows empty message when workbooks is undefined", () => {
    render(<WorkbookOverviewCards workbooks={undefined} isLoading={false} />);

    expect(screen.getByText("workbooks.noWorkbooks")).toBeInTheDocument();
  });

  it("renders workbook cards with names", () => {
    const workbooks = [
      createWorkbook({ id: "wb-1", name: "Alpha Workbook" }),
      createWorkbook({ id: "wb-2", name: "Beta Workbook" }),
    ];

    render(<WorkbookOverviewCards workbooks={workbooks} isLoading={false} />);

    expect(screen.getByText("Alpha Workbook")).toBeInTheDocument();
    expect(screen.getByText("Beta Workbook")).toBeInTheDocument();
  });

  it("renders cell count badges", () => {
    const workbooks = [
      createWorkbook({
        id: "wb-1",
        name: "Has Cells",
        cells: [createProtocolCell({ id: "c1" }), createMacroCell({ id: "c2" })],
      }),
    ];

    render(<WorkbookOverviewCards workbooks={workbooks} isLoading={false} />);

    expect(screen.getByText("2 cells")).toBeInTheDocument();
  });

  it("uses singular 'cell' for single cell workbook", () => {
    const workbooks = [
      createWorkbook({
        id: "wb-1",
        name: "Single",
        cells: [createProtocolCell({ id: "c1" })],
      }),
    ];

    render(<WorkbookOverviewCards workbooks={workbooks} isLoading={false} />);

    expect(screen.getByText("1 cell")).toBeInTheDocument();
  });

  it("renders links to workbook detail pages", () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Test WB" })];

    render(<WorkbookOverviewCards workbooks={workbooks} isLoading={false} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/workbooks/wb-1"));
  });

  it("shows last updated date", () => {
    const workbooks = [
      createWorkbook({ id: "wb-1", name: "Dated", updatedAt: "2024-06-15T00:00:00.000Z" }),
    ];

    render(<WorkbookOverviewCards workbooks={workbooks} isLoading={false} />);

    expect(screen.getByText(/workbooks\.lastUpdate/)).toBeInTheDocument();
  });
});
