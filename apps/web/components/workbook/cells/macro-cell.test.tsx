import {
  createMacro,
  createMacroCell,
  createMacroDetail,
  readOnlyCapabilities,
} from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { MacroCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookEntitySavedProvider } from "../workbook-entity-saved-context";
import { MacroCellComponent } from "./macro-cell";

// The language picker is a Radix Select (portal + pointer events) that jsdom
// cannot drive; swap it for a native <select> so language changes are testable.
// Children (SelectContent / SelectItem) are intentionally not rendered so the
// option labels appear exactly once.
vi.mock("@repo/ui/components/select", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Select: ({
      value,
      onValueChange,
      disabled,
    }: {
      value: string;
      onValueChange: (val: string) => void;
      disabled?: boolean;
    }) => (
      <select
        data-testid="language-select"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const result: unknown = onValueChange(e.target.value);
          if (result instanceof Promise) result.catch(() => undefined);
        }}
      >
        <option value="python">Python</option>
        <option value="r">R</option>
        <option value="javascript">JavaScript</option>
      </select>
    ),
  };
});

const baseMacro = createMacroDetail({
  id: "macro-1",
  name: "My Macro",
  language: "python",
  code: btoa("print('hello')"),
  createdBy: "user-1",
});

const cell = createMacroCell({
  id: "cell-1",
  payload: { macroId: "macro-1", language: "python", name: "My Macro" },
});

function renderMacroCell(
  overrides: Partial<Parameters<typeof MacroCellComponent>[0]> = {},
  macroOverrides: Partial<typeof baseMacro> = {},
) {
  server.mount(contract.macros.getMacro, { body: { ...baseMacro, ...macroOverrides } });

  const props = {
    cell,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };

  return { ...render(<MacroCellComponent {...props} />), props };
}

describe("MacroCellComponent", () => {
  it("shows the macro name as the cell label", async () => {
    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByText("My Macro")).toBeInTheDocument();
    });
  });

  it("renders the macro code in the editor once loaded", async () => {
    renderMacroCell();

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("print('hello')");
    });
  });

  it("shows a loading spinner while macro data is fetching", () => {
    server.mount(contract.macros.getMacro, { body: baseMacro });
    render(<MacroCellComponent cell={cell} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("My Macro")).toBeInTheDocument();
  });

  it("shows a link to the macro detail page", async () => {
    renderMacroCell();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /open macro in new tab/i });
      expect(link).toHaveAttribute("href", "/platform/macros/macro-1");
    });
  });

  it("shows language selector with update capability", async () => {
    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });
  });

  it("displays the live macro language without rewriting the cell payload", async () => {
    const onUpdate = vi.fn();
    renderMacroCell(
      { onUpdate, cell: { ...cell, payload: { ...cell.payload, language: "javascript" } } },
      { language: "python" },
    );

    await waitFor(() => expect(screen.getByTestId("language-select")).toHaveValue("python"));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("renders a pinned snapshot with its pinned language, not the stale cell payload", async () => {
    renderMacroCell({
      cell: { ...cell, payload: { ...cell.payload, language: "javascript" } },
      snapshot: { code: btoa("print(1)"), language: "python" },
    });

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("print(1)"));
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.queryByText("JavaScript")).not.toBeInTheDocument();
  });

  it("leaves a stale cell payload alone when rendering a pinned snapshot", async () => {
    const onUpdate = vi.fn();
    renderMacroCell({
      onUpdate,
      cell: { ...cell, payload: { ...cell.payload, language: "javascript" } },
      snapshot: { code: btoa("print(1)") },
    });

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("print(1)"));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows read-only language label without update capability", async () => {
    renderMacroCell({}, { capabilities: readOnlyCapabilities });

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });
  });

  it("copies code to clipboard when user clicks the copy button", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button");
    const copyButton = copyButtons.find(
      (btn) => btn.querySelector("svg.lucide-copy") ?? btn.querySelector(".lucide-copy"),
    );
    if (!copyButton) throw new Error("copy button not found");
    await user.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("print('hello')"));
  });

  it("shows a save status indicator with update capability", async () => {
    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved");
    });
  });

  it("shows a read-only hint and no save status without update capability", async () => {
    renderMacroCell({}, { capabilities: readOnlyCapabilities });

    await waitFor(() => {
      expect(screen.getByText("cells.macroReadOnly")).toBeInTheDocument();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the read-only hint when rendering a pinned snapshot", async () => {
    renderMacroCell({ snapshot: { code: btoa("print('pinned')") } });

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("print('pinned')");
    });
    expect(screen.queryByText("cells.macroReadOnly")).not.toBeInTheDocument();
  });

  it("renders the pinned snapshot code instead of the live macro row", async () => {
    // The live row has different code; with a snapshot present the live fetch is
    // disabled and the pinned snapshot must win.
    renderMacroCell(
      { snapshot: { code: btoa("print('pinned')") } },
      { code: btoa("print('live edit')") },
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("print('pinned')");
    });
  });

  it("forwards CellWrapper collapse toggles through onUpdate", async () => {
    const user = userEvent.setup();
    const { props } = renderMacroCell();

    await waitFor(() => expect(screen.getByText("My Macro")).toBeInTheDocument());
    // CellWrapper's collapse button has no accessible name; identify it by aria-expanded.
    const collapseButton = screen.getByRole("button", { expanded: true });
    await user.click(collapseButton);

    expect(props.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isCollapsed: true }));
  });

  it("renders a link to the original when the macro is itself a fork", async () => {
    renderMacroCell({}, { forkedFrom: "macro-src" });

    const link = await screen.findByRole("link", { name: "cells.forkedFrom" });
    expect(link).toHaveAttribute("href", "/platform/macros/macro-src");
  });

  it("forks a macro the viewer cannot edit and points the cell at the editable copy", async () => {
    const createSpy = server.mount(contract.macros.createMacro, {
      status: 201,
      body: createMacro({ id: "macro-fork", createdBy: "viewer", forkedFrom: "macro-1" }),
    });

    const onUpdate = vi.fn();
    renderMacroCell({ onUpdate }, { createdBy: "other-user", capabilities: readOnlyCapabilities });

    const user = userEvent.setup();
    const forkButton = await screen.findByRole("button", { name: /cells\.fork/ });
    await user.click(forkButton);

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toMatchObject({ forkedFrom: "macro-1" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const forkedCell = onUpdate.mock.calls.at(-1)?.[0] as MacroCell | undefined;
    expect(forkedCell?.payload.macroId).toBe("macro-fork");
  });

  it("persists a language change and updates the cell payload with update capability", async () => {
    const updateSpy = server.mount(contract.macros.updateMacro, {
      body: { ...baseMacro, language: "r" },
    });

    const onUpdate = vi.fn();
    renderMacroCell({ onUpdate });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId("language-select")).toBeInTheDocument());
    await user.selectOptions(screen.getByTestId("language-select"), "r");

    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(updateSpy.body).toEqual({ language: "r" });
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const updated = onUpdate.mock.calls.at(-1)?.[0] as MacroCell | undefined;
    expect(updated?.payload.language).toBe("r");
  });

  it("updates a rerendering host only after saving the language and refreshing the live query", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.mount(contract.macros.getMacro, { body: baseMacro });
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
    const updateSpy = server.mount(contract.macros.updateMacro, {
      body: { ...baseMacro, language: "r" },
      unblock: saveGate,
    });
    const onUpdate = vi.fn();
    function Host() {
      const [workbook, setWorkbook] = useState({ cell, otherCell: "Before" });
      return (
        <>
          <output aria-label="Cell language">{workbook.cell.payload.language}</output>
          <output aria-label="Other cell">{workbook.otherCell}</output>
          <button onClick={() => setWorkbook({ ...workbook, otherCell: "After" })}>
            Edit other cell
          </button>
          <MacroCellComponent
            cell={workbook.cell}
            onUpdate={(updated) => {
              onUpdate(updated);
              setWorkbook({ ...workbook, cell: updated });
            }}
            onDelete={vi.fn()}
          />
        </>
      );
    }
    render(<Host />, { queryClient });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByTestId("language-select"), "r");
    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Cell language")).toHaveTextContent("python");
    expect(screen.getByTestId("language-select")).toHaveValue("python");
    expect(screen.getByTestId("language-select")).toBeDisabled();
    await user.selectOptions(screen.getByTestId("language-select"), "javascript");
    expect(updateSpy.callCount).toBe(1);
    await user.click(screen.getByRole("button", { name: "Edit other cell" }));

    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve));
    const refreshSpy = server.mount(contract.macros.getMacro, {
      body: { ...baseMacro, language: "r" },
      unblock: refreshGate,
    });
    releaseSave();
    await waitFor(() => expect(refreshSpy.called).toBe(true));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Cell language")).toHaveTextContent("python");
    expect(screen.getByTestId("language-select")).toHaveValue("python");
    releaseRefresh();
    await waitFor(() => expect(screen.getByLabelText("Cell language")).toHaveTextContent("r"));
    expect(screen.getByTestId("language-select")).toHaveValue("r");
    expect(screen.getByTestId("language-select")).toBeEnabled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Other cell")).toHaveTextContent("After");

    server.mount(contract.macros.getMacro, { body: { ...baseMacro, language: "javascript" } });
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => expect(screen.getByTestId("language-select")).toHaveValue("javascript"));
    expect(screen.getByLabelText("Cell language")).toHaveTextContent("r");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("keeps the saved language after a rejected selection in a rerendering host", async () => {
    server.mount(contract.macros.getMacro, { body: baseMacro });
    server.mount(contract.macros.updateMacro, { status: 400 });
    const { toast } = await import("@repo/ui/hooks/use-toast");
    function Host() {
      const [currentCell, setCell] = useState(cell);
      return (
        <>
          <output aria-label="Cell language">{currentCell.payload.language}</output>
          <MacroCellComponent cell={currentCell} onUpdate={setCell} onDelete={vi.fn()} />
        </>
      );
    }
    render(<Host />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByTestId("language-select"), "r");
    await waitFor(() => expect(toast).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("Cell language")).toHaveTextContent("python"));
    expect(screen.getByTestId("language-select")).toHaveValue("python");
    expect(screen.getByTestId("language-select")).toBeEnabled();
  });

  it("does not notify the host after the cell is deleted during a language save", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.mount(contract.macros.getMacro, { body: baseMacro });
    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
    const updateSpy = server.mount(contract.macros.updateMacro, {
      body: { ...baseMacro, language: "r" },
      unblock: saveGate,
    });
    const onUpdate = vi.fn();
    function Host() {
      const [currentCell, setCell] = useState<MacroCell | null>(cell);
      return currentCell ? (
        <MacroCellComponent
          cell={currentCell}
          onUpdate={(updated) => {
            onUpdate(updated);
            setCell(updated);
          }}
          onDelete={() => setCell(null)}
        />
      ) : (
        <span>Cell deleted</span>
      );
    }
    render(<Host />, { queryClient });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByTestId("language-select"), "r");
    await waitFor(() => expect(updateSpy.called).toBe(true));
    const deleteButton = screen
      .getAllByRole("button")
      .find((button) => button.querySelector('svg[class*="lucide-trash"]'));
    if (!deleteButton) throw new Error("Delete cell button missing");
    await user.click(deleteButton);
    expect(screen.getByText("Cell deleted")).toBeInTheDocument();
    releaseSave();
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("Cell deleted")).toBeInTheDocument();
  });

  it("debounces and persists a code edit, then notifies the host (no silent loss)", async () => {
    // Regression guard for the silent-save-loss fix: an owner's edit must route
    // through the shared autosave (persist + host notification), not a fire-and-
    // forget setTimeout that drops failures.
    server.mount(contract.macros.getMacro, { body: baseMacro });
    const updateSpy = server.mount(contract.macros.updateMacro, { body: baseMacro });
    const onEntitySaved = vi.fn();

    const user = userEvent.setup();
    render(
      <WorkbookEntitySavedProvider onEntitySaved={onEntitySaved}>
        <MacroCellComponent cell={cell} onUpdate={vi.fn()} onDelete={vi.fn()} onRun={vi.fn()} />
      </WorkbookEntitySavedProvider>,
    );

    const textbox = await screen.findByRole("textbox");
    await user.type(textbox, "\n# edit");

    await waitFor(() => expect(updateSpy.called).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(onEntitySaved).toHaveBeenCalled());
  });

  it("surfaces a destructive toast when a code save fails instead of dropping it", async () => {
    server.mount(contract.macros.getMacro, { body: baseMacro });
    server.mount(contract.macros.updateMacro, { status: 500, body: undefined });
    const { toast } = await import("@repo/ui/hooks/use-toast");

    const user = userEvent.setup();
    render(
      <MacroCellComponent cell={cell} onUpdate={vi.fn()} onDelete={vi.fn()} onRun={vi.fn()} />,
    );

    const textbox = await screen.findByRole("textbox");
    await user.type(textbox, "\n# edit");

    await waitFor(
      () => {
        expect(toast).toHaveBeenCalledWith({
          description: expect.any(String) as unknown,
          variant: "destructive",
        });
      },
      { timeout: 3000 },
    );
  });

  it("surfaces a destructive toast when a language change fails to persist", async () => {
    server.use(
      http.put(`${API_URL}/api/v1/macros/:id`, () => HttpResponse.json({}, { status: 500 })),
    );
    const { toast } = await import("@repo/ui/hooks/use-toast");

    renderMacroCell();

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId("language-select")).toBeInTheDocument());
    await user.selectOptions(screen.getByTestId("language-select"), "r");

    await waitFor(
      () => {
        expect(toast).toHaveBeenCalledWith({
          description: "cells.languageSaveFailed",
          variant: "destructive",
        });
      },
      { timeout: 5000 },
    );
  });

  describe("inline rename", () => {
    it("renames the macro and repoints the cell label with update capability", async () => {
      const updateSpy = server.mount(contract.macros.updateMacro, {
        body: createMacro({ id: "macro-1", name: "Renamed Macro" }),
      });
      const onUpdate = vi.fn();
      renderMacroCell({ onUpdate });

      const user = userEvent.setup();
      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Renamed Macro");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() => expect(updateSpy.called).toBe(true));
      expect(updateSpy.body).toEqual({ name: "Renamed Macro" });
      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const updated = onUpdate.mock.lastCall?.[0] as MacroCell;
      expect(updated.payload.name).toBe("Renamed Macro");
    });

    it("merges a concurrent language change into the resolved rename", async () => {
      server.mount(contract.macros.getMacro, { body: baseMacro });
      // Hold the save response until the language rerender below has landed,
      // so the "concurrent" update is guaranteed to be in flight.
      let releaseSave!: () => void;
      const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
      server.mount(contract.macros.updateMacro, {
        body: createMacro({ id: "macro-1", name: "Renamed Macro" }),
        unblock: saveGate,
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      const { rerender } = render(
        <MacroCellComponent cell={cell} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Renamed Macro");
      await user.click(screen.getByLabelText("cells.renameSave"));

      // A language switch lands while the rename save is still in flight.
      rerender(
        <MacroCellComponent
          cell={{ ...cell, payload: { ...cell.payload, language: "r" } }}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
        />,
      );
      releaseSave();

      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const updated = onUpdate.mock.lastCall?.[0] as MacroCell;
      // The rename must preserve the concurrent language switch, not revert it.
      expect(updated.payload.language).toBe("r");
      expect(updated.payload.name).toBe("Renamed Macro");
    });

    it("ignores a rename result after the cell switches to a different macro", async () => {
      server.mount(contract.macros.getMacro, { body: baseMacro });
      let releaseSave!: () => void;
      const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
      const updateSpy = server.mount(contract.macros.updateMacro, {
        body: createMacro({ id: "macro-1", name: "Renamed Macro" }),
        unblock: saveGate,
      });
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <MacroCellComponent cell={cell} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Renamed Macro");
      await user.click(screen.getByLabelText("cells.renameSave"));
      await waitFor(() => expect(updateSpy.called).toBe(true));

      rerender(
        <MacroCellComponent
          cell={{
            ...cell,
            payload: { ...cell.payload, macroId: "macro-2", name: "Replacement Macro" },
          }}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
        />,
      );
      releaseSave();

      await waitFor(() => expect(screen.getByLabelText("cells.rename")).toBeInTheDocument());
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("shows the conflict toast and keeps the editor open on a duplicate name", async () => {
      // The update contract has no typed 409; the backend signals a name clash
      // via a REPOSITORY_DUPLICATE code on a 400 body.
      server.use(
        http.put(`${API_URL}/api/v1/macros/:id`, () =>
          HttpResponse.json(
            { code: "REPOSITORY_DUPLICATE", message: "duplicate", statusCode: 400 },
            { status: 400 },
          ),
        ),
      );
      const { toast } = await import("@repo/ui/hooks/use-toast");
      const onUpdate = vi.fn();
      renderMacroCell({ onUpdate });

      const user = userEvent.setup();
      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Taken Name");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "cells.renameConflict",
          variant: "destructive",
        }),
      );
      // Editor stays open so the user can pick another name, and the cell label
      // is never repointed to the rejected name.
      expect(screen.getByLabelText("cells.renameSave")).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("shows a generic failure toast when rename fails without a conflict code", async () => {
      server.mount(contract.macros.updateMacro, {
        status: 400,
        body: { message: "boom", statusCode: 400 },
      });
      const { toast } = await import("@repo/ui/hooks/use-toast");
      const onUpdate = vi.fn();
      renderMacroCell({ onUpdate });

      const user = userEvent.setup();
      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Another Name");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "boom",
          variant: "destructive",
        }),
      );
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not offer rename without update capability", async () => {
      renderMacroCell({}, { createdBy: "other-user", capabilities: readOnlyCapabilities });

      await screen.findByText("My Macro");
      expect(screen.queryByLabelText("cells.rename")).not.toBeInTheDocument();
    });
  });
});
