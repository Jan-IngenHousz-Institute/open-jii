import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import ExperimentArchivePage from "./page";

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: ({ archived }: { archived: boolean }) => (
    <div data-testid="list-experiments" data-archived={String(archived)} />
  ),
}));

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

const defaultProps = {
  params: Promise.resolve({ locale: "en-US" }),
  searchParams: Promise.resolve({}),
};

describe("ExperimentArchivePage", () => {
  it("lets the shell own the title and renders the archived list", async () => {
    render(await ExperimentArchivePage(defaultProps));

    expect(screen.queryByText("experiments.archiveTitle")).not.toBeInTheDocument();

    const list = screen.getByTestId("list-experiments");
    expect(list).toHaveAttribute("data-archived", "true");
  });

  it("fetches the archived view's first page while the server renders", async () => {
    render(await ExperimentArchivePage(defaultProps));

    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain('"status":"archived"');
    expect(queries).toContain('"page":1');
  });
});
