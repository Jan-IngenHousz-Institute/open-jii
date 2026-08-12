import { __resetProtocolCodeRegistry, getLiveProtocolCode } from "@/lib/protocol-code-registry";
import { createProtocol, createProtocolDetail, readOnlyCapabilities } from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { ProtocolCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookEntitySavedProvider } from "../workbook-entity-saved-context";
import { ProtocolCellComponent } from "./protocol-cell";

vi.mock("../workbook-code-editor", () => ({
  WorkbookCodeEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="code-editor-wrapper" data-readonly={String(!!readOnly)}>
      <pre data-testid="code-editor">{value}</pre>
      {onChange && (
        <>
          <button
            data-testid="simulate-change"
            onClick={() => onChange('[{"measurement":"new","duration":10}]')}
          >
            change
          </button>
          <button data-testid="simulate-invalid" onClick={() => onChange("not json")}>
            invalid
          </button>
          <button data-testid="simulate-non-array" onClick={() => onChange('{"x":1}')}>
            non-array
          </button>
          <button data-testid="simulate-same" onClick={() => onChange(value)}>
            same
          </button>
        </>
      )}
    </div>
  ),
}));

function makeProtocolCell(overrides: Partial<ProtocolCell> = {}): ProtocolCell {
  return {
    id: "proto-1",
    type: "protocol",
    payload: { protocolId: "p1", version: 1, name: "Light Sensor" },
    isCollapsed: false,
    ...overrides,
  };
}

const protocol = createProtocolDetail({
  id: "p1",
  name: "Light Sensor",
  code: [{ measurement: "light", duration: 5 }],
  family: "multispeq",
});

describe("ProtocolCellComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetProtocolCodeRegistry();
    server.mount(contract.protocols.getProtocol, { body: protocol });
  });

  // Guarantee fake timers never leak into a later test if an assertion throws
  // before a test's own vi.useRealTimers() runs.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the protocol name and its code once loaded", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("Light Sensor")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("code-editor").textContent).toContain('"measurement"');
    expect(screen.getByTestId("code-editor").textContent).toContain('"light"');
  });

  it("renders the pinned snapshot code instead of the live protocol row", async () => {
    // beforeEach mounts the live protocol (code: "light"); with a snapshot present
    // the live fetch is disabled and the pinned snapshot must win.
    render(
      <ProtocolCellComponent
        cell={makeProtocolCell()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        snapshot={{ code: [{ measurement: "pinned", duration: 9 }], family: "multispeq" }}
        readOnly
      />,
    );

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());
    expect(screen.getByTestId("code-editor").textContent).toContain('"pinned"');
    expect(screen.getByTestId("code-editor").textContent).not.toContain('"light"');
  });

  it("shows an external link to view the full protocol", () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    const link = screen.getByRole("link", { name: /open protocol in new tab/i });
    expect(link).toHaveAttribute("href", "/platform/protocols/p1");
  });

  it("lets the user copy the protocol code", async () => {
    document.execCommand = vi.fn();
    const user = userEvent.setup();
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());

    const copyButton = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          btn.querySelector("svg")?.classList.contains("lucide-copy") ??
          btn.querySelector("[class*='copy']") !== null,
      );
    if (copyButton) {
      await user.click(copyButton);
    }
  });

  it("renders an empty array as an editable editor for newly-created protocols", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [] }),
    });

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());
    expect(screen.getByTestId("code-editor").textContent).toBe("[]");
    expect(screen.queryByText("Could not load protocol code")).not.toBeInTheDocument();
  });

  it("shows the sensor family badge", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    });
  });

  it("renders the editor read-only without update capability on the protocol", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({
        id: "p1",
        code: [{ measurement: "light" }],
        createdBy: "someone",
        capabilities: readOnlyCapabilities,
      }),
    });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
    expect(screen.queryByTestId("simulate-change")).not.toBeInTheDocument();
  });

  it("renders the editor as editable with update capability on the protocol", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "false");
    });
    expect(screen.getByTestId("simulate-change")).toBeInTheDocument();
  });

  it("debounces and persists protocol code edits when a user with update capability types valid JSON", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup();
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    await waitFor(() => expect(updateSpy.called).toBe(true), { timeout: 3000 });
    expect(updateSpy.body).toEqual({ code: [{ measurement: "new", duration: 10 }] });
  });

  it("notifies the host after a successful save so the experiment can re-pin", async () => {
    // Protocol/macro code saves bypass the workbook cells autosave, so they must
    // signal via WorkbookEntitySavedProvider for the design page to auto-upgrade.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    server.mount(contract.protocols.updateProtocol, { body: createProtocol({ id: "p1" }) });
    const onEntitySaved = vi.fn();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <WorkbookEntitySavedProvider onEntitySaved={onEntitySaved}>
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />
      </WorkbookEntitySavedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(onEntitySaved).toHaveBeenCalled());
    vi.useRealTimers();
  });

  it("does not persist when a user with update capability types unparseable JSON", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-invalid")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-invalid"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("does not persist when the parsed JSON is not an array", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-non-array")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-non-array"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("skips persistence when the new code matches the saved snapshot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-same")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-same"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("reflows the code without persisting when the format is toggled", async () => {
    // Layout is not content: autosave keys off the parsed protocol, so switching
    // between compact and expanded must not write to the server.
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light", duration: 5 }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("json-format-toggle")).toBeEnabled());
    const before = screen.getByTestId("code-editor").textContent;

    await user.click(screen.getByTestId("json-format-toggle"));
    await vi.advanceTimersByTimeAsync(1500);

    const after = screen.getByTestId("code-editor").textContent;
    expect(after).not.toBe(before);
    expect(JSON.parse(after)).toEqual(JSON.parse(before));
    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("still persists a real edit made after the format was toggled", async () => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light", duration: 5 }] }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("json-format-toggle")).toBeEnabled());
    await user.click(screen.getByTestId("json-format-toggle"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(updateSpy.called).toBe(false);

    await user.click(screen.getByTestId("simulate-change"));
    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() => expect(updateSpy.called).toBe(true));
    vi.useRealTimers();
  });

  it("exposes the latest edited code to the run flow immediately, before the debounce", async () => {
    // The run flow reads the live editor code rather than re-fetching from the
    // server, so an edit is runnable straight away (no waiting out the 1000ms
    // autosave debounce), and never a stale saved version.
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    const user = userEvent.setup();
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    // No timers advanced: the debounced save has not fired, yet the run flow can
    // already read the freshly edited code from the editor.
    expect(getLiveProtocolCode("p1")).toEqual([{ measurement: "new", duration: 10 }]);
  });

  it("forwards CellWrapper collapse toggles through onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("Light Sensor")).toBeInTheDocument());
    // CellWrapper's collapse button has no accessible name; identify it by aria-expanded.
    const collapseButton = screen.getByRole("button", { expanded: true });
    await user.click(collapseButton);

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isCollapsed: true }));
  });

  it("forces the editor read-only regardless of ownership when readOnly prop is set", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
    });
    render(
      <ProtocolCellComponent
        cell={makeProtocolCell()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        readOnly
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
  });

  // The cell reuses the shared `useAutosave` + `AutosaveIndicator` so its save
  // status reads identically to the standalone protocol/macro editors. The
  // compact indicator exposes its label as the `role="status"` aria-label, and
  // i18n resolves to the raw key in tests (e.g. "autosave.saved").
  describe("save status indicator", () => {
    function mountOwnedProtocol() {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
      });
    }

    it("shows the saved state for the owner once the protocol loads", async () => {
      mountOwnedProtocol();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      // The indicator can render a tick after the editor mounts, so assert it
      // eventually rather than synchronously.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved"),
      );
    });

    it("shows the saving state immediately after a valid edit, before the debounce", async () => {
      mountOwnedProtocol();
      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      await user.click(screen.getByTestId("simulate-change"));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saving"),
      );
    });

    it("returns to the saved state once the debounced save persists", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mountOwnedProtocol();
      const updateSpy = server.mount(contract.protocols.updateProtocol, {
        body: createProtocol({ id: "p1" }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      await user.click(screen.getByTestId("simulate-change"));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saving"),
      );
      await vi.advanceTimersByTimeAsync(1100);
      await waitFor(() => expect(updateSpy.called).toBe(true));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved"),
      );
      vi.useRealTimers();
    });

    it("shows the failed state when persistence errors", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mountOwnedProtocol();
      server.mount(contract.protocols.updateProtocol, { status: 500, body: undefined });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      await user.click(screen.getByTestId("simulate-change"));

      await vi.advanceTimersByTimeAsync(1100);
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.failed"),
      );
      vi.useRealTimers();
    });

    it("does not show a save status for non-owners", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          code: [{ measurement: "light" }],
          createdBy: "someone",
          capabilities: readOnlyCapabilities,
        }),
      });
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("stays read-only for a non-owner even when the parent passes readOnly={false}", async () => {
      // A workbook owner editing their workbook passes readOnly={false} down to
      // every cell; a protocol they did not create must still be non-editable.
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          code: [{ measurement: "light" }],
          createdBy: "someone",
          capabilities: readOnlyCapabilities,
        }),
      });
      render(
        <ProtocolCellComponent
          cell={makeProtocolCell()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          readOnly={false}
        />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
    });

    it("forks a protocol the viewer cannot edit and points the cell at the editable copy", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          name: "Alice Proto",
          code: [{ measurement: "light" }],
          createdBy: "someone",
          capabilities: readOnlyCapabilities,
        }),
      });
      const createSpy = server.mount(contract.protocols.createProtocol, {
        status: 201,
        body: createProtocol({ id: "p1-fork", createdBy: "viewer", forkedFrom: "p1" }),
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      const forkButton = await screen.findByRole("button", { name: /cells\.fork/ });
      await user.click(forkButton);

      await waitFor(() => expect(createSpy.called).toBe(true));
      expect(createSpy.body).toMatchObject({ forkedFrom: "p1" });
      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const forkedCell = onUpdate.mock.calls.at(-1)?.[0] as ProtocolCell | undefined;
      expect(forkedCell?.payload.protocolId).toBe("p1-fork");
    });

    it("leaves the cell unchanged when forking a protocol the viewer cannot edit fails", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          code: [{ measurement: "light" }],
          createdBy: "someone",
          capabilities: readOnlyCapabilities,
        }),
      });
      const createSpy = server.mount(contract.protocols.createProtocol, {
        status: 500,
        body: undefined,
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      const forkButton = await screen.findByRole("button", { name: /cells\.fork/ });
      await user.click(forkButton);

      await waitFor(() => expect(createSpy.called).toBe(true));
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  it("renders a link to the original when the protocol is itself a fork", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "p1", forkedFrom: "p-src" }),
    });

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    const link = await screen.findByRole("link", { name: "cells.forkedFrom" });
    expect(link).toHaveAttribute("href", "/platform/protocols/p-src");
  });

  describe("inline rename", () => {
    it("renames the protocol and repoints the cell label with update capability", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          name: "Light Sensor",
          code: [{ measurement: "light" }],
        }),
      });
      const updateSpy = server.mount(contract.protocols.updateProtocol, {
        body: createProtocol({ id: "p1", name: "Fluorescence" }),
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Fluorescence");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() => expect(updateSpy.called).toBe(true));
      expect(updateSpy.body).toEqual({ name: "Fluorescence" });
      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const updated = onUpdate.mock.lastCall?.[0] as ProtocolCell;
      expect(updated.payload.name).toBe("Fluorescence");
    });

    it("merges a concurrent cell change into the resolved rename", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          name: "Light Sensor",
          code: [{ measurement: "light" }],
        }),
      });
      server.mount(contract.protocols.updateProtocol, {
        body: createProtocol({ id: "p1", name: "Fluorescence" }),
        delay: 100,
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      const { rerender } = render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      const input = screen.getByLabelText("cells.rename");
      await user.clear(input);
      await user.type(input, "Fluorescence");
      await user.click(screen.getByLabelText("cells.renameSave"));

      // A collapse toggle lands while the rename save is still in flight.
      rerender(
        <ProtocolCellComponent
          cell={makeProtocolCell({ isCollapsed: true })}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
        />,
      );

      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const updated = onUpdate.mock.lastCall?.[0] as ProtocolCell;
      // The rename must preserve the concurrent collapse, not revert it.
      expect(updated.isCollapsed).toBe(true);
      expect(updated.payload.name).toBe("Fluorescence");
    });

    it("does not offer rename to non-owners", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({
          id: "p1",
          code: [{ measurement: "light" }],
          createdBy: "someone",
          capabilities: readOnlyCapabilities,
        }),
      });
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
      expect(screen.queryByLabelText("cells.rename")).not.toBeInTheDocument();
    });

    it("keeps the editor open and does not repoint the cell when the rename fails", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
      });
      const updateSpy = server.mount(contract.protocols.updateProtocol, {
        status: 500,
        body: { message: "boom", statusCode: 500 },
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      await user.clear(screen.getByLabelText("cells.rename"));
      await user.type(screen.getByLabelText("cells.rename"), "Taken");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() => expect(updateSpy.called).toBe(true));
      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByLabelText("cells.renameSave")).toBeInTheDocument();
    });

    it("shows the conflict toast and keeps the editor open on a duplicate name", async () => {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocolDetail({ id: "p1", code: [{ measurement: "light" }] }),
      });
      // The update contract has no typed 409; the backend signals a name clash
      // via a REPOSITORY_DUPLICATE code on a 400 body.
      server.use(
        http.patch(`${API_URL}/api/v1/protocols/:id`, () =>
          HttpResponse.json(
            { code: "REPOSITORY_DUPLICATE", message: "duplicate", statusCode: 400 },
            { status: 400 },
          ),
        ),
      );
      const { toast } = await import("@repo/ui/hooks/use-toast");
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByLabelText("cells.rename"));
      await user.clear(screen.getByLabelText("cells.rename"));
      await user.type(screen.getByLabelText("cells.rename"), "Taken Name");
      await user.click(screen.getByLabelText("cells.renameSave"));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "cells.renameConflict",
          variant: "destructive",
        }),
      );
      expect(screen.getByLabelText("cells.renameSave")).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});
