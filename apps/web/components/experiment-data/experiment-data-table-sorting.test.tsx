import { createExperiment, createExperimentDataTable } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ExperimentDataTable } from "./experiment-data-table";

const columns: ExperimentDataColumn[] = [
  { name: "id", type_name: "BIGINT", type_text: "BIGINT" },
  { name: "answer", type_name: "STRING", type_text: "STRING" },
  { name: "label", type_name: "STRING", type_text: "STRING" },
];
const query = (page: number, orderBy: string, orderDirection: string) => ({
  tableName: "raw_data",
  page: String(page),
  pageSize: "10",
  orderBy,
  orderDirection,
});

function pageBody(page: number, prefix: string) {
  return [
    createExperimentDataTable({
      name: "raw_data",
      page,
      pageSize: 10,
      totalPages: 2,
      totalRows: 20,
      data: {
        columns,
        rows: [{ id: `${page}`, answer: prefix, label: `label-${prefix}` }],
        totalRows: 20,
        truncated: false,
      },
    }),
  ];
}

function orderedHandler(expected: ReturnType<typeof query>[]) {
  server.mount(contract.experiments.getExperiment, {
    body: createExperiment({ id: "numeric-sort" }),
  });
  const seen: Record<string, string>[] = [];
  const spy = server.mount(contract.experiments.getExperimentData, {
    body: ({ query: request }: SpyCall) => {
      seen.push(request);
      const step = expected.at(seen.length - 1);
      const matches =
        step &&
        Object.keys(request).length === Object.keys(step).length &&
        Object.entries(step).every(([key, value]) => request[key] === value);
      return pageBody(
        Number(request.page),
        matches ? `response-${seen.length}` : "UNEXPECTED_REQUEST",
      );
    },
  });
  return { seen, spy };
}

async function expectPage(page: number, response: number) {
  await screen.findByText(`response-${response}`, { exact: true });
  expect(screen.getByText(`dataTable.page ${page} dataTable.pageOf 2`)).toBeInTheDocument();
}

const props = {
  experimentId: "numeric-sort",
  tableName: "raw_data",
  pageSize: 10,
  defaultSortColumn: "id",
};

describe("ExperimentDataTable sorting requests", () => {
  it("resets column changes and both direction toggles in the same request", async () => {
    const expected = [
      query(1, "id", "DESC"),
      query(2, "id", "DESC"),
      query(1, "answer", "ASC"),
      query(2, "answer", "ASC"),
      query(1, "answer", "DESC"),
      query(2, "answer", "DESC"),
      query(1, "answer", "ASC"),
      query(1, "label", "ASC"),
    ];
    const { seen } = orderedHandler(expected);
    const user = userEvent.setup();
    render(<ExperimentDataTable {...props} />);
    await expectPage(1, 1);
    expect(seen).toEqual(expected.slice(0, 1));
    const click = async (target: HTMLElement, page: number, response: number) => {
      await user.click(target);
      await waitFor(
        () =>
          expect(seen, "sort must reset page before fetching").toEqual(expected.slice(0, response)),
        { timeout: 1000 },
      );
      await expectPage(page, response);
      expect(seen).toEqual(expected.slice(0, response));
    };
    await click(screen.getByTitle("dataTable.next"), 2, 2);
    await click(screen.getByRole("columnheader", { name: "answer" }), 1, 3);
    await click(screen.getByTitle("dataTable.next"), 2, 4);
    await click(screen.getByRole("columnheader", { name: "answer" }), 1, 5);
    await click(screen.getByTitle("dataTable.next"), 2, 6);
    await click(screen.getByRole("columnheader", { name: "answer" }), 1, 7);
    await click(screen.getByRole("columnheader", { name: "label" }), 1, 8);
  });

  it("hides stale page-two rows while a changed ordering loads", async () => {
    const expected = [query(1, "id", "DESC"), query(2, "id", "DESC"), query(1, "answer", "ASC")];
    const { seen } = orderedHandler(expected.slice(0, 2));
    const user = userEvent.setup();
    render(<ExperimentDataTable {...props} />);
    await expectPage(1, 1);
    await user.click(screen.getByTitle("dataTable.next"));
    await expectPage(2, 2);
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sort = server.mount(contract.experiments.getExperimentData, {
      unblock: pending,
      body: ({ query: request }: SpyCall) => {
        expect(request, "sort must reset page before fetching").toEqual(expected[2]);
        return pageBody(1, "new-first-page");
      },
    });
    await user.click(screen.getByRole("columnheader", { name: "answer" }));
    await waitFor(() => expect(sort.calls.map((call) => call.query)).toEqual([expected[2]]));
    expect(seen).toEqual(expected.slice(0, 2));
    expect(screen.getByText("dataTable.page 1 dataTable.pageOf 2")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).queryByText("response-2", { exact: true }),
    ).not.toBeInTheDocument();
    release?.();
    await screen.findByText("new-first-page", { exact: true });
    expect(screen.getByText("dataTable.page 1 dataTable.pageOf 2")).toBeInTheDocument();
    expect([...seen, ...sort.calls.map((call) => call.query)]).toEqual(expected);
  });
  it("clears off-screen row selection when sorting resets the page", async () => {
    const expected = [query(1, "id", "DESC"), query(2, "id", "DESC"), query(1, "answer", "ASC")];
    const { seen } = orderedHandler(expected);
    const user = userEvent.setup();
    render(<ExperimentDataTable {...props} />);
    await expectPage(1, 1);
    await user.click(screen.getByTitle("dataTable.next"));
    await expectPage(2, 2);
    await user.click(screen.getByRole("checkbox", { name: "Select row" }));
    expect(screen.getByRole("checkbox", { name: "Select row" })).toBeChecked();
    expect(
      screen.queryByText("experimentDataAnnotations.bulkActions.noRowsSelected"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("columnheader", { name: "answer" }));
    await expectPage(1, 3);
    expect(
      screen.getByText("experimentDataAnnotations.bulkActions.noRowsSelected"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select row" })).not.toBeChecked();
    expect(seen).toEqual(expected);
  });
});
