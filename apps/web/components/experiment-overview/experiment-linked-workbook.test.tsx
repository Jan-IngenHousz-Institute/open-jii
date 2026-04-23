import {
  createMacroCell,
  createOutputCell,
  createProtocolCell,
  createWorkbook,
  createWorkbookVersionSummary,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { ExperimentLinkedWorkbook } from "./experiment-linked-workbook";

const workbookId = "11111111-1111-1111-1111-111111111111";

describe("ExperimentLinkedWorkbook", () => {
  it("returns null when workbookId is null", () => {
    const { container } = render(<ExperimentLinkedWorkbook workbookId={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows skeleton while loading", () => {
    server.mount(contract.workbooks.getWorkbook, { body: createWorkbook(), delay: 999_999 });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [], delay: 999_999 });
    render(<ExperimentLinkedWorkbook workbookId={workbookId} />);
    expect(screen.getByText("workbooks.workbook")).toBeInTheDocument();
  });

  it("renders workbook name and view link", async () => {
    const workbook = createWorkbook({ id: workbookId, name: "Field Protocol v2" });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    render(<ExperimentLinkedWorkbook workbookId={workbookId} />);

    await waitFor(() => {
      expect(screen.getByText("Field Protocol v2")).toBeInTheDocument();
    });
    expect(screen.getByText("workbooks.viewWorkbook")).toBeInTheDocument();
  });

  it("renders description when present", async () => {
    const workbook = createWorkbook({
      id: workbookId,
      description: "Measures chlorophyll fluorescence",
    });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    render(<ExperimentLinkedWorkbook workbookId={workbookId} />);

    await waitFor(() => {
      expect(screen.getByText("Measures chlorophyll fluorescence")).toBeInTheDocument();
    });
  });

  it("renders cell summary pills", async () => {
    const cells = [
      createProtocolCell({ id: "c1" }),
      createMacroCell({ id: "c2" }),
      createMacroCell({ id: "c3" }),
      createOutputCell({ id: "c4", producedBy: "c1" }),
    ];
    const workbook = createWorkbook({ id: workbookId, cells });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    render(<ExperimentLinkedWorkbook workbookId={workbookId} />);

    await waitFor(() => {
      expect(screen.getByText(/1 Protocol/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 Macros/)).toBeInTheDocument();
  });

  it("shows empty cells message when workbook has no cells", async () => {
    const workbook = createWorkbook({ id: workbookId, cells: [] });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    render(<ExperimentLinkedWorkbook workbookId={workbookId} />);

    await waitFor(() => {
      expect(screen.getByText("workbooks.noCells")).toBeInTheDocument();
    });
  });

  it("returns null when workbook is not found", async () => {
    server.mount(contract.workbooks.getWorkbook, { status: 404 });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    const { container } = render(<ExperimentLinkedWorkbook workbookId={workbookId} />);

    await waitFor(() => {
      // After loading finishes with 404, component returns null
      expect(container.querySelector("[class*='space-y']")).toBeNull();
    });
  });

  it("renders version badge when workbookVersionId matches a version", async () => {
    const versionId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const workbook = createWorkbook({ id: workbookId, name: "Versioned WB" });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, {
      body: [
        createWorkbookVersionSummary({ id: versionId, workbookId, version: 2 }),
        createWorkbookVersionSummary({ workbookId, version: 1 }),
      ],
    });

    render(<ExperimentLinkedWorkbook workbookId={workbookId} workbookVersionId={versionId} />);

    await waitFor(() => {
      expect(screen.getByText("v2")).toBeInTheDocument();
    });
  });
});
