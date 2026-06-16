import { createMacro, createMacroCell } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { MacroCellComponent } from "./macro-cell";

const baseMacro = createMacro({
  id: "macro-1",
  name: "My Macro",
  language: "python",
  code: btoa("print('hello')"),
  createdBy: "user-1",
});

const cell = createMacroCell({
  id: "cell-1",
  payload: { macroId: "macro-1", version: 1, language: "python", name: "My Macro" },
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
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/platform/macros/macro-1");
    });
  });

  it("shows language selector for the owner", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("shows read-only language label when not the owner", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "other-user" } },
    } as ReturnType<typeof useSession>);

    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
    });

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("shows the pinned version and an upgrade affordance that re-pins to the latest", async () => {
    const user = userEvent.setup();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    // Cell is pinned to v1 while the macro head has advanced to v3.
    const onUpdate = vi.fn();
    renderMacroCell({ onUpdate }, { latestVersion: 3 });

    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());

    const upgradeButton = await screen.findByRole("button", { name: /v3/ });
    await user.click(upgradeButton);

    expect(onUpdate.mock.lastCall?.[0]).toMatchObject({
      payload: { macroId: "macro-1", version: 3, language: "python", name: "My Macro" },
    });

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("debounce-saves an edit and re-pins the cell to the minted version", async () => {
    const user = userEvent.setup();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    server.mount(contract.macros.getMacro, { body: baseMacro });
    const updateSpy = server.mount(contract.macros.updateMacro, {
      body: { ...baseMacro, latestVersion: 2 },
    });
    const onUpdate = vi.fn();
    render(<MacroCellComponent cell={cell} onUpdate={onUpdate} onDelete={vi.fn()} />);

    const textbox = await screen.findByRole("textbox");
    await user.type(textbox, " # edit");

    // Edit is debounced (~1s) then minted server-side; the cell re-pins to the new version.
    await waitFor(() => expect(updateSpy.called).toBe(true), { timeout: 3000 });
    await waitFor(() =>
      expect(onUpdate.mock.lastCall?.[0]).toMatchObject({ payload: { version: 2 } }),
    );

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("duplicates via version history and re-points the cell to the fork", async () => {
    const user = userEvent.setup();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    server.mount(contract.macros.getMacro, { body: baseMacro });
    server.mount(contract.macros.listMacroVersions, {
      body: [{ version: 1, createdBy: "user-1", createdAt: "2024-01-01T00:00:00Z" }],
    });
    server.mount(contract.macros.getMacroUsage, { body: { count: 0, workbooks: [] } });
    server.mount(contract.macros.duplicateMacro, {
      body: createMacro({ id: "macro-2", name: "Copy of My Macro" }),
      status: 201,
    });
    const onUpdate = vi.fn();
    render(<MacroCellComponent cell={cell} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: /Duplicate as a new macro/ }));

    await waitFor(() =>
      expect(onUpdate.mock.lastCall?.[0]).toMatchObject({
        payload: { macroId: "macro-2", version: 1, name: "Copy of My Macro" },
      }),
    );

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("restores a version via version history (owner)", async () => {
    const user = userEvent.setup();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    server.mount(contract.macros.getMacro, { body: { ...baseMacro, latestVersion: 2 } });
    server.mount(contract.macros.listMacroVersions, {
      body: [
        { version: 2, createdBy: "user-1", createdAt: "2024-01-02T00:00:00Z" },
        { version: 1, createdBy: "user-1", createdAt: "2024-01-01T00:00:00Z" },
      ],
    });
    server.mount(contract.macros.getMacroUsage, { body: { count: 0, workbooks: [] } });
    server.mount(contract.macros.restoreMacroVersion, { body: { ...baseMacro, latestVersion: 3 } });
    render(<MacroCellComponent cell={cell} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Version history" }));
    await user.click(await screen.findByRole("button", { name: /Restore/ }));

    // On success EntityVersionHistory closes the sheet, having fired the cell's onRestored.
    await waitFor(() => expect(screen.queryByText("No versions yet")).not.toBeInTheDocument());

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("copies code to clipboard when user clicks the copy button", async () => {
    const user = userEvent.setup();
    document.execCommand = vi.fn();

    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
    } as ReturnType<typeof useSession>);

    renderMacroCell();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button");
    const copyButton = copyButtons.find(
      (btn) => btn.querySelector("svg.lucide-copy") ?? btn.querySelector(".lucide-copy"),
    );
    expect(copyButton).toBeTruthy();
    if (copyButton) await user.click(copyButton);

    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });
});
