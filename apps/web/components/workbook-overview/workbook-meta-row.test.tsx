import {
  createMarkdownCell,
  createWorkbook,
  createWorkbookDetail,
  createWorkbookVersionSummary,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { WorkbookMetaRow } from "./workbook-meta-row";

describe("WorkbookMetaRow", () => {
  const workbook = createWorkbookDetail({
    id: "wb-1",
    name: "Photosynthesis Lab",
    createdBy: "user-1",
    createdByName: "Test User",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", name: "Test User", email: "test@test.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    // Default: an unpublished workbook (no versions). Tests that need a
    // published version re-mount the handler.
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });
  });

  function renderRow(overrides: Partial<typeof workbook> = {}) {
    return render(<WorkbookMetaRow id="wb-1" workbook={{ ...workbook, ...overrides }} />);
  }

  it("shows who created the workbook", () => {
    renderRow();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows a dash when createdByName is null", () => {
    renderRow({ createdByName: undefined });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows a link to the source workbook when it is a fork", () => {
    renderRow({ forkedFrom: "wb-src" });
    expect(screen.getByText("workbooks.forkedFrom")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "common.viewOriginal" });
    expect(link).toHaveAttribute("href", "/platform/workbooks/wb-src");
  });

  it("does not show the fork link for a non-fork workbook", () => {
    renderRow();
    expect(screen.queryByText("workbooks.forkedFrom")).not.toBeInTheDocument();
  });

  it("shows the latest published version number", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, {
      body: [
        createWorkbookVersionSummary({ workbookId: "wb-1", version: 3 }),
        createWorkbookVersionSummary({ workbookId: "wb-1", version: 2 }),
      ],
    });

    renderRow();

    expect(await screen.findByText("v3")).toBeInTheDocument();
  });

  it("shows a draft label when the workbook has no published versions", async () => {
    renderRow();
    expect(await screen.findByText("workbooks.draftVersion")).toBeInTheDocument();
  });

  it("falls back to a dash (not 'Draft') when the versions fetch fails", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, { status: 500 });

    renderRow({ createdByName: "Test User" });

    // The version cell shows "-" rather than wrongly claiming the workbook is a draft.
    expect(await screen.findByText("-")).toBeInTheDocument();
    expect(screen.queryByText("workbooks.draftVersion")).not.toBeInTheDocument();
  });

  it("forks the workbook and posts forkedFrom", async () => {
    const sourceCells = [
      createMarkdownCell({ id: "source-cell", content: "<p>Source instructions</p>" }),
    ];
    const sourceMetadata = { crop: "maize", trialYear: 2026 };
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "99999999-9999-9999-9999-999999999999" }),
    });
    const user = userEvent.setup();
    renderRow({
      name: "Distinctive field workbook",
      description: "A workbook description that must survive forking.",
      cells: sourceCells,
      metadata: sourceMetadata,
    });

    await user.click(await screen.findByRole("button", { name: "workbooks.actions.fork" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({
      name: "Fork of Distinctive field workbook",
      description: "A workbook description that must survive forking.",
      cells: sourceCells,
      metadata: sourceMetadata,
      forkedFrom: "wb-1",
    });
  });

  it("shows the fork button to viewers who are not the creator", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "someone-else" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    renderRow({ createdBy: "user-1" });

    expect(
      await screen.findByRole("button", { name: "workbooks.actions.fork" }),
    ).toBeInTheDocument();
  });

  it("shows the visibility state as a plain provenance field, not a control", () => {
    renderRow({ visibility: "private" });

    expect(screen.getByText("resourceVisibility.statusLabel")).toBeInTheDocument();
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
    // The state is read-only here; publishing is an action, over with the others.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // The copy is the info icon's accessible name, readable without hovering.
    expect(screen.getByLabelText("resourceVisibility.privateDescription")).toBeInTheDocument();
  });

  it("offers Publish beside Fork while the workbook is private", async () => {
    renderRow({ visibility: "private" });

    expect(
      await screen.findByRole("button", { name: "resourceVisibility.publishAction" }),
    ).toBeInTheDocument();
  });

  it("hides Publish from a caller who cannot manage", () => {
    renderRow({
      visibility: "private",
      capabilities: { ...workbook.capabilities, canManage: false },
    });

    // Publishing is manage-gated, matching what the route enforces — but the
    // state itself is still worth showing to a viewer.
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });

  it("shows the public state with no Publish action left", () => {
    renderRow({ visibility: "public" });

    // Visibility is monotonic: there is nothing left to do.
    expect(screen.getByText("resourceVisibility.publicStatus")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("resourceVisibility.publishedDescription")).toBeInTheDocument();
  });

  it("confirms before publishing, then flips the field to public and drops the action", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.workbooks.setVisibility, {
      body: { id: "wb-1", visibility: "public" },
    });

    renderRow({ visibility: "private" });

    await user.click(screen.getByRole("button", { name: "resourceVisibility.publishAction" }));

    // Irreversible, so it is confirmed rather than written on the click itself.
    expect(screen.getByText("resourceVisibility.publishConfirmTitle")).toBeInTheDocument();
    expect(spy.called).toBe(false);

    await user.click(
      screen.getByRole("button", { name: "resourceVisibility.publishConfirmButton" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "wb-1" });
    expect(spy.body).toEqual({ visibility: "public" });

    await waitFor(() =>
      expect(screen.getByText("resourceVisibility.publicStatus")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "resourceVisibility.publishAction" }),
    ).not.toBeInTheDocument();
  });

  it("disables the Fork button while a fork is in flight", async () => {
    server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: createWorkbook({ id: "99999999-9999-9999-9999-999999999999" }),
      delay: "infinite",
    });
    const user = userEvent.setup();
    renderRow();

    const forkButton = await screen.findByRole("button", { name: "workbooks.actions.fork" });
    await user.click(forkButton);

    await waitFor(() => expect(forkButton).toBeDisabled());
  });
});
