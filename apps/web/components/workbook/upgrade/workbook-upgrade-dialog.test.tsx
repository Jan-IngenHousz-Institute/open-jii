import {
  createBranchCell,
  createMacro,
  createMacroCell,
  createProtocol,
  createProtocolCell,
  createWorkbook,
} from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { WorkbookVersion } from "@repo/api/schemas/workbook-version.schema";

import { WorkbookUpgradeDialog } from "./workbook-upgrade-dialog";

const WORKBOOK_ID = "wb-1";
const PINNED_VERSION_ID = "ver-1";
const PROTOCOL_ID = "prot-1";

const protocolCell = createProtocolCell({
  id: "cell-1",
  payload: { protocolId: PROTOCOL_ID, version: 1, name: "My Protocol" },
});

function mountPinned(entityCode: unknown) {
  const version: WorkbookVersion = {
    id: PINNED_VERSION_ID,
    workbookId: WORKBOOK_ID,
    version: 1,
    cells: [protocolCell],
    metadata: {},
    entitySnapshots: {
      protocols: { [PROTOCOL_ID]: { code: entityCode, family: "multispeq" } },
      macros: {},
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    createdBy: "user-1",
  };
  server.mount(contract.workbooks.getWorkbookVersion, { body: version });
}

function renderDialog(overrides: Partial<Parameters<typeof WorkbookUpgradeDialog>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    workbookId: WORKBOOK_ID,
    pinnedVersionId: PINNED_VERSION_ID,
    currentVersion: 1,
    targetVersionLabel: "v2",
    onConfirm: vi.fn(),
    isUpgrading: false,
    ...overrides,
  };
  return { ...render(<WorkbookUpgradeDialog {...props} />), props };
}

describe("WorkbookUpgradeDialog", () => {
  it("shows a changed protocol and a clean verdict, and confirms the upgrade", async () => {
    mountPinned([{ a: 1 }]);
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [protocolCell] }),
    });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({
        id: PROTOCOL_ID,
        name: "My Protocol",
        code: [{ a: 2 }],
        family: "multispeq",
        createdBy: "user-1",
      }),
    });

    const { props } = renderDialog();

    // Protocol code drifted -> a "changed" row for the protocol.
    expect(await screen.findByText("My Protocol")).toBeInTheDocument();
    expect(await screen.findByText("flow.upgradeDiff.status.changed")).toBeInTheDocument();
    // No cell-structure changes (same single cell).
    expect(screen.getByText("flow.upgradeDiff.noCellChanges")).toBeInTheDocument();
    // Single existing protocol, one family -> no structural issues.
    await waitFor(() =>
      expect(screen.getByText("flow.upgradeDiff.verdict.ok")).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /flow\.confirmUpgrade/ }));
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it("shows a changed macro in the code diff", async () => {
    const macroCell = createMacroCell({
      id: "cell-m",
      payload: { macroId: "mac-1", language: "python", name: "My Macro" },
    });
    const version: WorkbookVersion = {
      id: PINNED_VERSION_ID,
      workbookId: WORKBOOK_ID,
      version: 1,
      cells: [macroCell],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: { "mac-1": { code: btoa("print('v0')") } } },
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "user-1",
    };
    server.mount(contract.workbooks.getWorkbookVersion, { body: version });
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [macroCell] }),
    });
    server.mount(contract.macros.getMacro, {
      body: createMacro({
        id: "mac-1",
        name: "My Macro",
        code: btoa("print('v1')"),
        createdBy: "user-1",
      }),
    });

    renderDialog();

    expect(await screen.findByText("My Macro")).toBeInTheDocument();
    expect(await screen.findByText("flow.upgradeDiff.status.changed")).toBeInTheDocument();
  });

  it("flags a missing protocol as a blocking error", async () => {
    mountPinned([{ a: 1 }]);
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [protocolCell] }),
    });
    // The live protocol no longer exists.
    server.mount(contract.protocols.getProtocol, {
      status: 404,
      body: { message: "not found", statusCode: 404 },
    });

    renderDialog();

    await waitFor(() =>
      expect(screen.getByText("flow.upgradeDiff.verdict.errors")).toBeInTheDocument(),
    );
  });

  it("shows a load error (not a false missing block) when an entity lookup fails transiently", async () => {
    mountPinned([{ a: 1 }]);
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [protocolCell] }),
    });
    // A 500 is transient, not a genuine deletion: the dialog must not conclude
    // the protocol is missing.
    server.mount(contract.protocols.getProtocol, {
      status: 500,
      body: { message: "boom", statusCode: 500 },
    });

    renderDialog();

    expect(await screen.findByText("flow.upgradeDiff.loadError")).toBeInTheDocument();
    expect(screen.queryByText("flow.upgradeDiff.verdict.errors")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flow\.confirmUpgrade/ })).toBeDisabled();
  });

  it("lists a missing macro and dangling branch references as blocking errors", async () => {
    const macroCell = createMacroCell({
      id: "cell-m",
      payload: { macroId: "mac-gone", language: "python", name: "Gone Macro" },
    });
    const branchCell = createBranchCell({
      id: "cell-b",
      paths: [
        {
          id: "path-1",
          label: "Yes",
          color: "#22c55e",
          gotoCellId: "ghost-goto",
          conditions: [
            {
              id: "cond-1",
              sourceCellId: "ghost-src",
              field: "answer",
              operator: "eq",
              value: "x",
            },
          ],
        },
      ],
    });
    const version: WorkbookVersion = {
      id: PINNED_VERSION_ID,
      workbookId: WORKBOOK_ID,
      version: 1,
      cells: [macroCell],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: { "mac-gone": { code: btoa("print(1)") } } },
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "user-1",
    };
    server.mount(contract.workbooks.getWorkbookVersion, { body: version });
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [macroCell, branchCell] }),
    });
    // The referenced macro no longer exists.
    server.mount(contract.macros.getMacro, {
      status: 404,
      body: { message: "gone", statusCode: 404 },
    });

    renderDialog();

    await waitFor(() =>
      expect(screen.getByText("flow.upgradeDiff.verdict.errors")).toBeInTheDocument(),
    );
    expect(screen.getByText("flow.upgradeDiff.issue.missingMacro")).toBeInTheDocument();
    expect(screen.getByText("flow.upgradeDiff.issue.danglingSource")).toBeInTheDocument();
    expect(screen.getByText("flow.upgradeDiff.issue.danglingGoto")).toBeInTheDocument();
  });

  it("warns on mixed sensor families, shows an added cell, and cancels", async () => {
    const protoA = createProtocolCell({
      id: "cell-a",
      payload: { protocolId: "prot-a", version: 1, name: "Proto A" },
    });
    const protoB = createProtocolCell({
      id: "cell-b2",
      payload: { protocolId: "prot-b", version: 1, name: "Proto B" },
    });
    const version: WorkbookVersion = {
      id: PINNED_VERSION_ID,
      workbookId: WORKBOOK_ID,
      version: 1,
      // Pinned had only Proto A; Proto B is new since -> an "added" cell change.
      cells: [protoA],
      metadata: {},
      entitySnapshots: {
        protocols: { "prot-a": { code: [{ a: 1 }], family: "multispeq" } },
        macros: {},
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "user-1",
    };
    server.mount(contract.workbooks.getWorkbookVersion, { body: version });
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [protoA, protoB] }),
    });
    // Two families across the two protocols -> mixed-family warning.
    server.use(
      http.get(`${API_URL}/api/v1/protocols/:id`, ({ params }) =>
        HttpResponse.json(
          params.id === "prot-a"
            ? createProtocol({
                id: "prot-a",
                name: "Proto A",
                code: [{ a: 1 }],
                family: "multispeq",
                createdBy: "user-1",
              })
            : createProtocol({
                id: "prot-b",
                name: "Proto B",
                code: [{ b: 2 }],
                family: "ambyte",
                createdBy: "user-1",
              }),
        ),
      ),
    );

    const { props } = renderDialog();

    await waitFor(() =>
      expect(screen.getByText("flow.upgradeDiff.verdict.warnings")).toBeInTheDocument(),
    );
    expect(screen.getByText("flow.upgradeDiff.issue.mixedFamilies")).toBeInTheDocument();
    expect(screen.getByText("flow.upgradeDiff.change.added")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error state instead of spinning forever when a fetch fails", async () => {
    server.mount(contract.workbooks.getWorkbookVersion, {
      status: 404,
      body: { message: "gone", statusCode: 404 },
    });
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: WORKBOOK_ID, cells: [] }),
    });

    renderDialog();

    expect(await screen.findByText("flow.upgradeDiff.loadError")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flow\.confirmUpgrade/ })).toBeDisabled();
  });
});
