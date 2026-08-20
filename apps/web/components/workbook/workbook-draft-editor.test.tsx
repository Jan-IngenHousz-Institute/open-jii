import { createMarkdownCell, createProtocolCell } from "@/test/factories";
import { act, render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookDraftEditor } from "./workbook-draft-editor";

const updateWorkbook = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate", () => ({
  useWorkbookUpdate: () => ({ mutateAsync: updateWorkbook, isPending: false }),
}));

vi.mock("@/hooks/workbook/useWorkbookExecution/useWorkbookExecution", () => ({
  useWorkbookExecution: () => ({
    isConnected: false,
    isConnecting: false,
    connectedDevices: [],
    sensorFamily: "multispeq",
    setSensorFamily: vi.fn(),
    connectionType: "usb",
    setConnectionType: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    disconnectDevice: vi.fn(),
    executionStates: {},
    isRunningAll: false,
    runCell: vi.fn(),
    runAll: vi.fn(),
    stopExecution: vi.fn(),
    clearOutputs: vi.fn(),
  }),
}));

// Renders the cells it was handed; the button stands in for a keystroke.
vi.mock("./workbook-editor", () => ({
  WorkbookEditor: ({
    cells,
    onCellsChange,
  }: {
    cells: WorkbookCell[];
    onCellsChange: (c: WorkbookCell[]) => void;
  }) => (
    <div>
      <pre data-testid="cells">{JSON.stringify(cells)}</pre>
      <button
        onClick={() =>
          onCellsChange([...cells, createMarkdownCell({ id: "local-edit" })] as WorkbookCell[])
        }
      >
        local edit
      </button>
    </div>
  ),
}));

function renderedCells(): WorkbookCell[] {
  return JSON.parse(screen.getByTestId("cells").textContent) as WorkbookCell[];
}

function hasCell(id: string): boolean {
  return renderedCells().some((c) => c.id === id);
}

describe("WorkbookDraftEditor server reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    updateWorkbook.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const base = [createProtocolCell({ id: "cell-1" })] as WorkbookCell[];

  it("adopts a newer server copy while the editor is idle", async () => {
    const { rerender } = render(
      <WorkbookDraftEditor id="wb-1" initialCells={base} canEdit name="wb" />,
    );
    expect(hasCell("cell-1")).toBe(true);

    const fromServer = [
      createProtocolCell({ id: "cell-1" }),
      createMarkdownCell({ id: "added-elsewhere" }),
    ] as WorkbookCell[];
    rerender(<WorkbookDraftEditor id="wb-1" initialCells={fromServer} canEdit name="wb" />);

    await waitFor(() => expect(hasCell("added-elsewhere")).toBe(true));
  });

  it("does not echo the adopted copy back to the server", async () => {
    const { rerender } = render(
      <WorkbookDraftEditor id="wb-1" initialCells={base} canEdit name="wb" />,
    );
    const fromServer = [
      createProtocolCell({ id: "cell-1" }),
      createMarkdownCell({ id: "added-elsewhere" }),
    ] as WorkbookCell[];
    rerender(<WorkbookDraftEditor id="wb-1" initialCells={fromServer} canEdit name="wb" />);
    await waitFor(() => expect(hasCell("added-elsewhere")).toBe(true));

    // Past the debounce: adopting is not an edit.
    await vi.advanceTimersByTimeAsync(5000);
    expect(updateWorkbook).not.toHaveBeenCalled();
  });

  it("keeps unsaved local edits instead of adopting over them", async () => {
    const { rerender } = render(
      <WorkbookDraftEditor id="wb-1" initialCells={base} canEdit name="wb" />,
    );

    screen.getByRole("button", { name: "local edit" }).click();
    await waitFor(() => expect(hasCell("local-edit")).toBe(true));

    const fromServer = [
      createProtocolCell({ id: "cell-1" }),
      createMarkdownCell({ id: "added-elsewhere" }),
    ] as WorkbookCell[];
    rerender(<WorkbookDraftEditor id="wb-1" initialCells={fromServer} canEdit name="wb" />);

    expect(hasCell("local-edit")).toBe(true);
    expect(hasCell("added-elsewhere")).toBe(false);
  });

  it("keeps a local edit batched into the same commit as a server update", () => {
    const { rerender } = render(
      <WorkbookDraftEditor id="wb-1" initialCells={base} canEdit name="wb" />,
    );

    const fromServer = [
      createProtocolCell({ id: "cell-1" }),
      createMarkdownCell({ id: "added-elsewhere" }),
    ] as WorkbookCell[];

    act(() => {
      screen.getByRole("button", { name: "local edit" }).click();
      rerender(<WorkbookDraftEditor id="wb-1" initialCells={fromServer} canEdit name="wb" />);
    });

    expect(hasCell("local-edit")).toBe(true);
    expect(hasCell("added-elsewhere")).toBe(false);
  });
});
