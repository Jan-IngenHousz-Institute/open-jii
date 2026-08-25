import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import WorkbookPage from "./page";

describe("WorkbookPage (list)", () => {
  it("renders the heading and description", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(await WorkbookPage({ params: Promise.resolve({ locale: "en-US" }) }));

    expect(screen.getByRole("heading", { name: "workbooks.title" })).toBeInTheDocument();
    expect(screen.getByText("workbooks.listDescription")).toBeInTheDocument();
  });

  it("renders the workbook list once data resolves", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, {
      body: {
        items: [
          createWorkbook({ id: "wb-1", name: "Photosynthesis" }),
          createWorkbook({ id: "wb-2", name: "Respiration" }),
        ],
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalCount: 2,
      },
    });

    render(await WorkbookPage({ params: Promise.resolve({ locale: "en-US" }) }));

    await waitFor(() => {
      expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
      expect(screen.getByText("Respiration")).toBeInTheDocument();
    });
  });
});
