import {
  createMarkdownCell,
  createProtocolCell,
  createMacroCell,
  createQuestionCell,
  createOutputCell,
  createBranchCell,
  createProtocol,
  createMacro,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { WorkbookCell } from "@repo/api";
import { contract } from "@repo/api";

import { CellRenderer } from "./cell-renderer";

// CodeMirror does not run in jsdom — mock only the editor (system boundary)
vi.mock("./workbook-code-editor", () => ({
  WorkbookCodeEditor: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
  ),
}));

const noop = vi.fn();

describe("CellRenderer", () => {
  it("renders markdown cell with label", () => {
    const cell = createMarkdownCell();
    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText("Markdown")).toBeInTheDocument();
  });

  it("renders protocol cell with protocol name after loading", async () => {
    const protocolId = "p-1";
    const cell = createProtocolCell({
      payload: { protocolId, version: 1, name: "Light Sensor" },
    });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: protocolId, name: "Light Sensor" }),
    });

    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);

    await waitFor(() => expect(screen.getByText("Light Sensor")).toBeInTheDocument());
  });

  it("renders macro cell with macro name after loading", async () => {
    const macroId = "m-1";
    const cell = createMacroCell({ payload: { macroId, language: "python" } });
    server.mount(contract.macros.getMacro, {
      body: createMacro({ id: macroId, name: "Chlorophyll Calc" }),
    });

    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);

    await waitFor(() => expect(screen.getByText("Chlorophyll Calc")).toBeInTheDocument());
  });

  it("renders question cell with question text", () => {
    const cell = createQuestionCell({
      question: { kind: "open_ended", text: "Enter a value", required: false },
    });
    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByDisplayValue("Enter a value")).toBeInTheDocument();
  });

  it("renders output cell", () => {
    const cell = createOutputCell();
    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("renders branch cell with label", () => {
    const cell = createBranchCell();
    render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Yes")).toBeInTheDocument();
  });

  it("returns null for unknown cell type", () => {
    const cell = { id: "x", type: "unknown" } as unknown as WorkbookCell;
    const { container } = render(<CellRenderer cell={cell} onUpdate={noop} onDelete={noop} />);
    expect(container.innerHTML).toBe("");
  });
});
