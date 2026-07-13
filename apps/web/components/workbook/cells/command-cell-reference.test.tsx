import { __resetCommandCodeRegistry, getLiveCommandCode } from "@/lib/command-code-registry";
import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CommandCell } from "@repo/api/schemas/workbook-cells.schema";
import { isCommandReferencePayload } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";

import { WorkbookEntitySavedProvider } from "../workbook-entity-saved-context";
import { CommandCellComponent } from "./command-cell";

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

const mockedUseSession = vi.mocked(useSession);

const OWNER_ID = "owner-user-id";

function makeCommandCell(overrides: Partial<CommandCell> = {}): CommandCell {
  return {
    id: "proto-1",
    type: "command",
    payload: { commandId: "p1", version: 1, name: "Light Sensor" },
    isCollapsed: false,
    ...overrides,
  };
}

const command = createCommand({
  id: "p1",
  name: "Light Sensor",
  code: [{ measurement: "light", duration: 5 }],
  family: "multispeq",
});

describe("CommandCellComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCommandCodeRegistry();
    mockedUseSession.mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    server.mount(contract.commands.getCommand, { body: command });
  });

  // Guarantee fake timers never leak into a later test if an assertion throws
  // before a test's own vi.useRealTimers() runs.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the command name and its code once loaded", async () => {
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Light Sensor")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("code-editor").textContent).toContain('"measurement"');
    expect(screen.getByTestId("code-editor").textContent).toContain('"light"');
  });

  it("renders the pinned snapshot code instead of the live command row", async () => {
    // beforeEach mounts the live command (code: "light"); with a snapshot present
    // the live fetch is disabled and the pinned snapshot must win.
    render(
      <CommandCellComponent
        cell={makeCommandCell()}
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

  it("shows an external link to view the full command", () => {
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/commands/p1");
  });

  it("lets the user copy the command code", async () => {
    document.execCommand = vi.fn();
    const user = userEvent.setup();
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

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

  it("renders an empty array as an editable editor for newly-created commands", async () => {
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [] }),
    });

    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());
    expect(screen.getByTestId("code-editor").textContent).toBe("[]");
    expect(screen.queryByText("Could not load command code")).not.toBeInTheDocument();
  });

  it("shows the sensor family badge", async () => {
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    });
  });

  it("renders the editor read-only when the viewer is not the command owner", async () => {
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: "viewer" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
    expect(screen.queryByTestId("simulate-change")).not.toBeInTheDocument();
  });

  it("renders the editor as editable when the viewer owns the command", async () => {
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "false");
    });
    expect(screen.getByTestId("simulate-change")).toBeInTheDocument();
  });

  it("debounces and persists command code edits when the owner types valid JSON", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const updateSpy = server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(updateSpy.body).toEqual({ code: [{ measurement: "new", duration: 10 }] });
    vi.useRealTimers();
  });

  it("notifies the host after a successful save so the experiment can re-pin", async () => {
    // Command/macro code saves bypass the workbook cells autosave, so they must
    // signal via WorkbookEntitySavedProvider for the design page to auto-upgrade.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.commands.updateCommand, { body: createCommand({ id: "p1" }) });
    const onEntitySaved = vi.fn();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <WorkbookEntitySavedProvider onEntitySaved={onEntitySaved}>
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />
      </WorkbookEntitySavedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(onEntitySaved).toHaveBeenCalled());
    vi.useRealTimers();
  });

  it("does not persist when the owner types unparseable JSON", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const updateSpy = server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("simulate-invalid")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-invalid"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("does not persist when the parsed JSON is not an array", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const updateSpy = server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("simulate-non-array")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-non-array"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("skips persistence when the new code matches the saved snapshot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const updateSpy = server.mount(contract.commands.updateCommand, {
      body: createCommand({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("simulate-same")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-same"));
    await vi.advanceTimersByTimeAsync(1500);

    expect(updateSpy.called).toBe(false);
    vi.useRealTimers();
  });

  it("exposes the latest edited code to the run flow immediately, before the debounce", async () => {
    // The run flow reads the live editor code rather than re-fetching from the
    // server, so an edit is runnable straight away (no waiting out the 1000ms
    // autosave debounce), and never a stale saved version.
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    const user = userEvent.setup();
    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    // No timers advanced: the debounced save has not fired, yet the run flow can
    // already read the freshly edited code from the editor.
    expect(getLiveCommandCode("p1")).toEqual([{ measurement: "new", duration: 10 }]);
  });

  it("forwards CellWrapper collapse toggles through onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <CommandCellComponent cell={makeCommandCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("Light Sensor")).toBeInTheDocument());
    // CellWrapper's collapse button has no accessible name; identify it by aria-expanded.
    const collapseButton = screen.getByRole("button", { expanded: true });
    await user.click(collapseButton);

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isCollapsed: true }));
  });

  it("forces the editor read-only regardless of ownership when readOnly prop is set", async () => {
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <CommandCellComponent
        cell={makeCommandCell()}
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
  // status reads identically to the standalone command/macro editors. The
  // compact indicator exposes its label as the `role="status"` aria-label, and
  // i18n resolves to the raw key in tests (e.g. "autosave.saved").
  describe("save status indicator", () => {
    function mountOwnedCommand() {
      server.mount(contract.commands.getCommand, {
        body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: OWNER_ID } },
        isPending: false,
      } as ReturnType<typeof useSession>);
    }

    it("shows the saved state for the owner once the command loads", async () => {
      mountOwnedCommand();
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved");
    });

    it("shows the saving state immediately after a valid edit, before the debounce", async () => {
      mountOwnedCommand();
      const user = userEvent.setup();
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      await user.click(screen.getByTestId("simulate-change"));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saving"),
      );
    });

    it("returns to the saved state once the debounced save persists", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mountOwnedCommand();
      const updateSpy = server.mount(contract.commands.updateCommand, {
        body: createCommand({ id: "p1" }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      await user.click(screen.getByTestId("simulate-change"));

      await vi.advanceTimersByTimeAsync(1100);
      await waitFor(() => expect(updateSpy.called).toBe(true));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved"),
      );
      vi.useRealTimers();
    });

    it("shows the failed state when persistence errors", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mountOwnedCommand();
      server.mount(contract.commands.updateCommand, { status: 500, body: undefined });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
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
      server.mount(contract.commands.getCommand, {
        body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: "viewer" } },
        isPending: false,
      } as ReturnType<typeof useSession>);

      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("stays read-only for a non-owner even when the parent passes readOnly={false}", async () => {
      // A workbook owner editing their workbook passes readOnly={false} down to
      // every cell; a command they did not create must still be non-editable.
      server.mount(contract.commands.getCommand, {
        body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: "viewer" } },
        isPending: false,
      } as ReturnType<typeof useSession>);

      render(
        <CommandCellComponent
          cell={makeCommandCell()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          readOnly={false}
        />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
    });

    it("forks a non-owned command and points the cell at the editable copy", async () => {
      server.mount(contract.commands.getCommand, {
        body: createCommand({
          id: "p1",
          name: "Alice Proto",
          code: [{ measurement: "light" }],
          createdBy: "someone",
        }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: "viewer" } },
        isPending: false,
      } as ReturnType<typeof useSession>);
      const createSpy = server.mount(contract.commands.createCommand, {
        status: 201,
        body: createCommand({ id: "p1-fork", createdBy: "viewer", forkedFrom: "p1" }),
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      const forkButton = await screen.findByRole("button", { name: /cells\.fork/ });
      await user.click(forkButton);

      await waitFor(() => expect(createSpy.called).toBe(true));
      expect(createSpy.body).toMatchObject({ forkedFrom: "p1" });
      await waitFor(() => expect(onUpdate).toHaveBeenCalled());
      const forkedCell = onUpdate.mock.calls.at(-1)?.[0] as CommandCell | undefined;
      expect(
        forkedCell && isCommandReferencePayload(forkedCell.payload)
          ? forkedCell.payload.commandId
          : undefined,
      ).toBe("p1-fork");
    });

    it("leaves the cell unchanged when forking a non-owned command fails", async () => {
      server.mount(contract.commands.getCommand, {
        body: createCommand({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: "viewer" } },
        isPending: false,
      } as ReturnType<typeof useSession>);
      const createSpy = server.mount(contract.commands.createCommand, {
        status: 500,
        body: undefined,
      });
      const onUpdate = vi.fn();

      const user = userEvent.setup();
      render(
        <CommandCellComponent cell={makeCommandCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      const forkButton = await screen.findByRole("button", { name: /cells\.fork/ });
      await user.click(forkButton);

      await waitFor(() => expect(createSpy.called).toBe(true));
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  it("renders a link to the original when the command is itself a fork", async () => {
    server.mount(contract.commands.getCommand, {
      body: createCommand({ id: "p1", forkedFrom: "p-src" }),
    });

    render(<CommandCellComponent cell={makeCommandCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const link = await screen.findByRole("link", { name: "cells.forkedFrom" });
    expect(link).toHaveAttribute("href", "/platform/commands/p-src");
  });
});
