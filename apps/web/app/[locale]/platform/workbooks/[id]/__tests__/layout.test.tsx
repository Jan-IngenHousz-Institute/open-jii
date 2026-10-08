import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Layout from "../layout";

const prefetched = vi.hoisted(() => {
  const state: { queries: unknown[]; embedWhen?: (data: unknown) => boolean } = { queries: [] };
  return state;
});

vi.mock("@/components/server-prefetch/prefetched-queries", () => ({
  PrefetchedQueries: ({
    queries,
    embedWhen,
    children,
  }: {
    queries: (utils: unknown) => unknown[];
    embedWhen?: (data: unknown) => boolean;
    children: React.ReactNode;
  }) => {
    prefetched.queries = queries(orpc);
    prefetched.embedWhen = embedWhen;
    return children;
  },
}));

vi.mock("@/components/workbook-overview/workbook-layout-shell", () => ({
  WorkbookLayoutShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("workbook layout", () => {
  it("fetches the workbook while the server renders, so the page arrives with its cells", async () => {
    render(await Layout({ children: <p>tab</p>, params: Promise.resolve({ id: "workbook-1" }) }));

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByText("tab")).toBeInTheDocument();
    expect(queries).toContain("getWorkbook");
    expect(queries).toContain('"id":"workbook-1"');
  });

  it("leaves a workbook too large to render on the server for the browser", async () => {
    render(await Layout({ children: <p>tab</p>, params: Promise.resolve({ id: "workbook-1" }) }));

    const cells = (count: number) => ({
      cells: Array.from({ length: count }, (_, i) => ({ id: i })),
    });
    expect(prefetched.embedWhen?.(cells(100))).toBe(true);
    expect(prefetched.embedWhen?.(cells(101))).toBe(false);
  });
});
