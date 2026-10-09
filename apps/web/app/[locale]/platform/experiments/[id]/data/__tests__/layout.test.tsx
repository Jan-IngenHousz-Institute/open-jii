import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Layout from "../layout";

const prefetched = vi.hoisted(() => {
  const state: { queries: unknown[] } = { queries: [] };
  return state;
});

vi.mock("@/components/server-prefetch/prefetched-queries", () => ({
  PrefetchedQueries: ({
    queries,
    children,
  }: {
    queries: (utils: unknown) => unknown[];
    children: React.ReactNode;
  }) => {
    prefetched.queries = queries(orpc);
    return children;
  },
}));

describe("data layout", () => {
  it("fetches the table list while the server renders, so the first page can load at once", async () => {
    render(await Layout({ children: <p>tab</p>, params: Promise.resolve({ id: "experiment-1" }) }));

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByText("tab")).toBeInTheDocument();
    expect(queries).toContain("getExperimentTables");
    expect(queries).toContain('"id":"experiment-1"');
  });
});
