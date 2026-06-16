import { __resetProtocolCodeRegistry, getLiveProtocolCode } from "@/lib/protocol-code-registry";
import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { ProtocolCell } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";

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

const mockedUseSession = vi.mocked(useSession);

const OWNER_ID = "owner-user-id";

function makeProtocolCell(overrides: Partial<ProtocolCell> = {}): ProtocolCell {
  return {
    id: "proto-1",
    type: "protocol",
    payload: { protocolId: "p1", version: 1, name: "Light Sensor" },
    isCollapsed: false,
    ...overrides,
  };
}

const protocol = createProtocol({
  id: "p1",
  name: "Light Sensor",
  code: [{ measurement: "light", duration: 5 }],
  family: "multispeq",
});

describe("ProtocolCellComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetProtocolCodeRegistry();
    mockedUseSession.mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    server.mount(contract.protocols.getProtocol, { body: protocol });
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

  it("shows an external link to view the full protocol", () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    const link = screen.getByRole("link");
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
      body: createProtocol({ id: "p1", code: [] }),
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

  it("renders the editor read-only when the viewer is not the protocol owner", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: "viewer" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
    expect(screen.queryByTestId("simulate-change")).not.toBeInTheDocument();
  });

  it("renders the editor as editable when the viewer owns the protocol", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "false");
    });
    expect(screen.getByTestId("simulate-change")).toBeInTheDocument();
  });

  it("debounces and persists protocol code edits when the owner types valid JSON", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const updateSpy = server.mount(contract.protocols.updateProtocol, {
      body: createProtocol({ id: "p1" }),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
    await user.click(screen.getByTestId("simulate-change"));

    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(updateSpy.body).toEqual({ code: [{ measurement: "new", duration: 10 }] });
    vi.useRealTimers();
  });

  it("does not persist when the owner types unparseable JSON", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
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
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
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
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);
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

  it("exposes the latest edited code to the run flow immediately, before the debounce", async () => {
    // The run flow reads the live editor code rather than re-fetching from the
    // server, so an edit is runnable straight away — no waiting out the 1000ms
    // autosave debounce, and never a stale saved version.
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

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
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

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
        body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: OWNER_ID } },
        isPending: false,
      } as ReturnType<typeof useSession>);
    }

    it("shows the saved state for the owner once the protocol loads", async () => {
      mountOwnedProtocol();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() => expect(screen.getByTestId("simulate-change")).toBeInTheDocument());
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saved");
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
        body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
      });
      mockedUseSession.mockReturnValue({
        data: { user: { id: "viewer" } },
        isPending: false,
      } as ReturnType<typeof useSession>);

      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true"),
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("version actions", () => {
    it("re-pins the cell to the latest version when the upgrade button is clicked", async () => {
      const user = userEvent.setup();
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: "p1", code: [{ measurement: "light" }], latestVersion: 3 }),
      });
      const onUpdate = vi.fn();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      const upgrade = await screen.findByRole("button", { name: /v3/ });
      await user.click(upgrade);

      expect(onUpdate.mock.lastCall?.[0]).toMatchObject({
        payload: { protocolId: "p1", version: 3, name: "Light Sensor" },
      });
    });

    it("duplicates via version history and re-points the cell to the fork (owner)", async () => {
      const user = userEvent.setup();
      mockedUseSession.mockReturnValue({
        data: { user: { id: OWNER_ID } },
        isPending: false,
      } as ReturnType<typeof useSession>);
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
      });
      server.mount(contract.protocols.listProtocolVersions, {
        body: [{ version: 1, createdBy: OWNER_ID, createdAt: "2024-01-01T00:00:00Z" }],
      });
      server.mount(contract.protocols.getProtocolUsage, { body: { count: 0, workbooks: [] } });
      server.mount(contract.protocols.duplicateProtocol, {
        body: createProtocol({ id: "p2", name: "Copy of Light Sensor" }),
        status: 201,
      });
      const onUpdate = vi.fn();
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={onUpdate} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Version history" }));
      await user.click(await screen.findByRole("button", { name: /Duplicate as a new protocol/ }));

      await waitFor(() =>
        expect(onUpdate.mock.lastCall?.[0]).toMatchObject({
          payload: { protocolId: "p2", version: 1, name: "Copy of Light Sensor" },
        }),
      );
    });

    it("resets the local buffer after a restore (owner)", async () => {
      const user = userEvent.setup();
      mockedUseSession.mockReturnValue({
        data: { user: { id: OWNER_ID } },
        isPending: false,
      } as ReturnType<typeof useSession>);
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({
          id: "p1",
          code: [{ measurement: "light" }],
          createdBy: OWNER_ID,
          latestVersion: 2,
        }),
      });
      server.mount(contract.protocols.listProtocolVersions, {
        body: [
          { version: 2, createdBy: OWNER_ID, createdAt: "2024-01-02T00:00:00Z" },
          { version: 1, createdBy: OWNER_ID, createdAt: "2024-01-01T00:00:00Z" },
        ],
      });
      server.mount(contract.protocols.getProtocolUsage, { body: { count: 0, workbooks: [] } });
      const restoreSpy = server.mount(contract.protocols.restoreProtocolVersion, {
        body: createProtocol({ id: "p1" }),
      });
      render(
        <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
      );

      await user.click(await screen.findByRole("button", { name: "Version history" }));
      await user.click(await screen.findByRole("button", { name: /Restore/ }));

      // Gate on the restore request actually firing (for the non-latest v1) before checking state.
      await waitFor(() => expect(restoreSpy.called).toBe(true));
      expect(String(restoreSpy.calls[0]?.params?.version)).toBe("1");
    });
  });
});
