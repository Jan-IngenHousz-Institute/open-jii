import { createExperiment, createMacro, createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { getExperimentColumns } from "./experiment-columns";
import { getMacroColumns } from "./macro-columns";
import { getOrganizationColumns } from "./organization-columns";
import { OverviewTable } from "./overview-table";
import type { OverviewTableColumn } from "./overview-table";
import { getProtocolColumns } from "./protocol-columns";
import { getWorkbookColumns } from "./workbook-columns";

const t = (key: string) => key;

interface StubItem {
  id: string;
  name: string;
}

const stubColumns: OverviewTableColumn<StubItem>[] = [
  {
    header: "Name",
    cell: (item, href) => <a href={href}>{item.name}</a>,
  },
];

function renderStubTable(
  items: StubItem[] | undefined,
  isLoading = false,
  error?: unknown,
  onRetry?: () => void,
) {
  return render(
    <OverviewTable
      columns={stubColumns}
      items={items}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      errorMessage="Could not load items"
      retryLabel="Try again"
      getRowKey={(item) => item.id}
      getRowHref={(item) => `/platform/stubs/${item.id}`}
      emptyMessage="Nothing here"
      emptyHelpPath="/guide/stubs"
    />,
  );
}

function expectColumnHiddenBelowItsBreakpoint(headerName: string) {
  const header = screen.getByRole("columnheader", { name: headerName });
  const headerRow = header.parentElement;
  const columnIndex = headerRow ? Array.from(headerRow.children).indexOf(header) : -1;

  expect(columnIndex).toBeGreaterThanOrEqual(0);
  expect(header).toHaveClass("hidden");

  const table = header.closest("table");
  for (const row of table?.querySelectorAll("tbody tr") ?? []) {
    expect(row.children.item(columnIndex)).toHaveClass("hidden");
  }
}

describe("OverviewTable", () => {
  it("renders skeleton rows while loading", () => {
    const { container } = renderStubTable(undefined, true);

    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
  });

  it("renders a recoverable error when loading finishes without data", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderStubTable(undefined, false, new Error("request failed"), onRetry);

    expect(screen.getByText("Could not load items")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders the empty state with a docs help link", () => {
    renderStubTable([]);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toContain("/guide/stubs");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row per item and navigates on row click", async () => {
    const user = userEvent.setup();
    const { router } = renderStubTable([
      { id: "a", name: "First" },
      { id: "b", name: "Second" },
    ]);

    expect(screen.getByRole("link", { name: "First" }).getAttribute("href")).toBe(
      "/platform/stubs/a",
    );

    const row = screen.getByText("Second").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(row);
    expect(router.push).toHaveBeenCalledWith("/platform/stubs/b");
  });

  it("uses a fixed, bordered layout and clips cell content before it can crowd later columns", () => {
    renderStubTable([{ id: "a", name: "A name that is deliberately much wider than its cell" }]);

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed");
    expect(table.parentElement?.parentElement).toHaveClass(
      "border",
      "overflow-hidden",
      "rounded-md",
    );
    expect(table.parentElement?.parentElement).not.toHaveClass("border-y");

    for (const cell of table.querySelectorAll("tbody td")) {
      expect(cell).toHaveClass("min-w-0", "overflow-hidden");
    }
  });
});

describe("experiment overview columns", () => {
  function renderExperiments(experiments: ReturnType<typeof createExperiment>[]) {
    return render(
      <OverviewTable
        columns={getExperimentColumns(t, "en-US", [])}
        items={experiments}
        getRowKey={(experiment) => experiment.id}
        getRowHref={(experiment) => `/platform/experiments/${experiment.id}`}
        emptyMessage="experiments.noExperiments"
      />,
    );
  }

  it("renders name link, description, and updated date", () => {
    renderExperiments([
      createExperiment({ id: "e-1", name: "Photosynthesis", description: "Light reactions" }),
    ]);

    expect(screen.getByRole("link", { name: "Photosynthesis" })).toHaveAttribute(
      "title",
      "Photosynthesis",
    );
    expect(screen.getByRole("link", { name: "Photosynthesis" })).toHaveClass("min-w-0", "truncate");
    expect(screen.getByText("Light reactions")).toHaveClass("break-words", "whitespace-normal");
  });

  it("shows the visibility badge only for private experiments", () => {
    renderExperiments([
      createExperiment({ id: "e-1", name: "Public Exp", visibility: "public" }),
      createExperiment({ id: "e-2", name: "Private Exp", visibility: "private" }),
    ]);

    const privateRow = screen.getByText("Private Exp").closest("tr");
    if (!privateRow) throw new Error("row not found");
    expect(within(privateRow).getByText("resourceVisibility.privateStatus")).toBeInTheDocument();

    const publicRow = screen.getByText("Public Exp").closest("tr");
    if (!publicRow) throw new Error("row not found");
    expect(
      within(publicRow).queryByText("resourceVisibility.privateStatus"),
    ).not.toBeInTheDocument();
  });

  it("keeps the full localized status available when the fixed column truncates it", () => {
    renderExperiments([createExperiment({ id: "e-1", status: "archived" })]);

    const label = screen.getByText("status.archived");
    expect(label).toHaveClass("truncate");
    expect(label.parentElement).toHaveAttribute("title", "status.archived");
  });

  it("does not sacrifice the name column to the updated date on phones", () => {
    renderExperiments([createExperiment({ id: "e-1", name: "Photosynthesis" })]);

    expectColumnHiddenBelowItsBreakpoint("columns.updated");
    expect(screen.getByRole("columnheader", { name: "columns.updated" })).toHaveClass(
      "lg:table-cell",
    );
  });
});

describe("organization overview columns", () => {
  it("keeps the organization name as the primary phone column", () => {
    render(
      <OverviewTable
        columns={getOrganizationColumns(t)}
        items={[
          {
            id: "org-1",
            name: "JII",
            description: null,
            memberCount: 4,
            resourceCount: 7,
            visibility: "public",
            isMember: true,
          },
        ]}
        getRowKey={(organization) => organization.id}
        getRowHref={(organization) => `/platform/organizations/${organization.id}`}
        emptyMessage="organizations.empty"
      />,
    );

    expectColumnHiddenBelowItsBreakpoint("organizations.tabs.members");
    expectColumnHiddenBelowItsBreakpoint("organizations.resources.title");
    expect(screen.getByRole("columnheader", { name: "organizations.resources.title" })).toHaveClass(
      "lg:table-cell",
    );
  });
});

describe("protocol overview columns", () => {
  function renderProtocols(protocols: ReturnType<typeof createProtocol>[]) {
    return render(
      <OverviewTable
        columns={getProtocolColumns(t, "en-US", [])}
        items={protocols}
        getRowKey={(protocol) => protocol.id}
        getRowHref={(protocol) => `/platform/protocols/${protocol.id}`}
        emptyMessage="protocols.noProtocols"
      />,
    );
  }

  it("renders the family badge and marks preferred protocols", () => {
    renderProtocols([
      createProtocol({ id: "p-1", name: "Preferred P", sortOrder: 1, family: "multispeq" }),
      createProtocol({ id: "p-2", name: "Plain P", sortOrder: null }),
    ]);

    const preferredRow = screen.getByText("Preferred P").closest("tr");
    if (!preferredRow) throw new Error("row not found");
    expect(within(preferredRow).getByText("common.preferred")).toBeInTheDocument();
    expect(within(preferredRow).getByText("multispeq")).toBeInTheDocument();
    expect(within(preferredRow).getByRole("link", { name: "Preferred P" })).toHaveAttribute(
      "title",
      "Preferred P",
    );

    const plainRow = screen.getByText("Plain P").closest("tr");
    if (!plainRow) throw new Error("row not found");
    expect(within(plainRow).queryByText("common.preferred")).not.toBeInTheDocument();
  });

  it("reserves a bounded responsive column for compatible macros", () => {
    renderProtocols([createProtocol({ id: "p-1", name: "Protocol" })]);

    expect(screen.getByRole("columnheader", { name: "protocols.columns.macros" })).toHaveClass(
      "w-56",
      "xl:table-cell",
    );
  });

  it("keeps the name readable on phones by hiding secondary columns below their breakpoint", () => {
    renderProtocols([createProtocol({ id: "p-1", name: "Protocol" })]);

    expect(screen.getByRole("columnheader", { name: "protocols.columns.name" })).not.toHaveClass(
      "hidden",
    );
    expectColumnHiddenBelowItsBreakpoint("protocols.columns.family");
    expectColumnHiddenBelowItsBreakpoint("protocols.columns.macros");
    expectColumnHiddenBelowItsBreakpoint("protocols.columns.updated");
    expect(screen.getByRole("columnheader", { name: "protocols.columns.updated" })).toHaveClass(
      "lg:table-cell",
    );
  });
});

describe("macro overview columns", () => {
  it("renders the language label and marks preferred macros", () => {
    render(
      <OverviewTable
        columns={getMacroColumns(t, "en-US", [])}
        items={[createMacro({ id: "m-1", name: "M1", language: "python", sortOrder: 0 })]}
        getRowKey={(macro) => macro.id}
        getRowHref={(macro) => `/platform/macros/${macro.id}`}
        emptyMessage="macros.noMacros"
      />,
    );

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("common.preferred")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "M1" })).toHaveAttribute("title", "M1");
  });

  it("reserves a bounded responsive column for compatible protocols", () => {
    render(
      <OverviewTable
        columns={getMacroColumns(t, "en-US", [])}
        items={[createMacro({ id: "m-1", name: "M1" })]}
        getRowKey={(macro) => macro.id}
        getRowHref={(macro) => `/platform/macros/${macro.id}`}
        emptyMessage="macros.noMacros"
      />,
    );

    expect(screen.getByRole("columnheader", { name: "macros.columns.protocols" })).toHaveClass(
      "w-56",
      "xl:table-cell",
    );
  });

  it("keeps the name readable on phones by hiding secondary columns below their breakpoint", () => {
    render(
      <OverviewTable
        columns={getMacroColumns(t, "en-US")}
        items={[createMacro({ id: "m-1", name: "A_single_unbroken_macro_name" })]}
        getRowKey={(macro) => macro.id}
        getRowHref={(macro) => `/platform/macros/${macro.id}`}
        emptyMessage="macros.noMacros"
      />,
    );

    expect(screen.getByRole("columnheader", { name: "macros.columns.name" })).not.toHaveClass(
      "hidden",
    );
    expectColumnHiddenBelowItsBreakpoint("macros.columns.language");
    expectColumnHiddenBelowItsBreakpoint("macros.columns.protocols");
    expectColumnHiddenBelowItsBreakpoint("macros.columns.updated");
    expect(screen.getByRole("columnheader", { name: "macros.columns.updated" })).toHaveClass(
      "lg:table-cell",
    );
  });
});

function makeWorkbook(overrides: Partial<Workbook> & Pick<Workbook, "id" | "name">): Workbook {
  return {
    description: null,
    cells: [],
    metadata: {},
    createdBy: "00000000-0000-0000-0000-0000000000aa",
    createdByName: "Tester",
    forkedFrom: null,
    organizationId: null,
    visibility: "public",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderWorkbooks(workbooks: Workbook[]) {
  return render(
    <OverviewTable
      columns={getWorkbookColumns(t, "en-US", [])}
      items={workbooks}
      getRowKey={(workbook) => workbook.id}
      getRowHref={(workbook) => `/en-US/platform/workbooks/${workbook.id}`}
      emptyMessage="workbooks.noWorkbooks"
    />,
  );
}

describe("workbook overview columns", () => {
  const unused = makeWorkbook({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Unused WB",
    experimentCount: 0,
  });

  it("never offers Delete on a row, even for an unused workbook", async () => {
    // Lists include other people's public and shared workbooks, and a row has no
    // capability signal (they are detail-only, to avoid a `can()` per row) — so it
    // cannot tell a manager from a plain reader. Deletion lives on the detail
    // surface, gated on `can(manage)`.
    const user = userEvent.setup();
    renderWorkbooks([unused]);

    const row = screen.getByText("Unused WB").closest("tr");
    if (!row) throw new Error("row not found");
    expect(within(row).getByRole("link", { name: "Unused WB" })).toHaveAttribute(
      "title",
      "Unused WB",
    );
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await screen.findByRole("menuitem", { name: "workbooks.actions.open" });
    expect(
      screen.queryByRole("menuitem", { name: "workbooks.actions.delete" }),
    ).not.toBeInTheDocument();
  });

  it("reserves enough padded width for the workbook row-actions hit target", () => {
    renderWorkbooks([unused]);

    const actionButton = screen.getByLabelText("workbooks.actions.more");
    expect(actionButton.closest("td")).toHaveClass("w-14", "px-3");
  });

  it("keeps the workbook name as the primary phone column", () => {
    renderWorkbooks([unused]);

    expect(screen.getByRole("columnheader", { name: "workbooks.columns.name" })).not.toHaveClass(
      "hidden",
    );
    expectColumnHiddenBelowItsBreakpoint("workbooks.columns.usedBy");
    expectColumnHiddenBelowItsBreakpoint("workbooks.columns.user");
    expectColumnHiddenBelowItsBreakpoint("workbooks.columns.updated");
    expect(screen.getByRole("columnheader", { name: "workbooks.columns.updated" })).toHaveClass(
      "lg:table-cell",
    );
  });

  it("duplicates a workbook from the row menu", async () => {
    // List rows carry no cells, so duplication first fetches the full workbook.
    const source = makeWorkbook({
      id: "33333333-3333-3333-3333-333333333333",
      name: "Source WB",
      description: "desc",
      visibility: "private",
      experimentCount: 0,
    });
    server.mount(contract.workbooks.getWorkbook, { status: 200, body: source });
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: makeWorkbook({ id: "99999999-9999-9999-9999-999999999999", name: "Fork of Source WB" }),
    });
    const user = userEvent.setup();
    renderWorkbooks([source]);

    const row = screen.getByText("Source WB").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await user.click(await screen.findByRole("menuitem", { name: "workbooks.actions.fork" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Fork of Source WB", visibility: "private" });
  });

  it("shows an error toast when fetching the source workbook fails", async () => {
    const source = makeWorkbook({ id: "s-1", name: "Source WB", experimentCount: 0 });
    server.mount(contract.workbooks.getWorkbook, { status: 500 });
    const spy = server.mount(contract.workbooks.createWorkbook, { status: 201 });
    const user = userEvent.setup();
    renderWorkbooks([source]);

    const row = screen.getByText("Source WB").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await user.click(await screen.findByRole("menuitem", { name: "workbooks.actions.fork" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(spy.called).toBe(false);
  });

  it("shows an error toast when duplicate fails", async () => {
    const source = makeWorkbook({ id: "s-2", name: "Source WB", experimentCount: 0 });
    server.mount(contract.workbooks.getWorkbook, { status: 200, body: source });
    server.mount(contract.workbooks.createWorkbook, { status: 500 });
    const user = userEvent.setup();
    renderWorkbooks([source]);

    const row = screen.getByText("Source WB").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await user.click(await screen.findByRole("menuitem", { name: "workbooks.actions.fork" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
