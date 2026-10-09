import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Page from "../page";

vi.mock("@/components/list-macros", () => ({
  ListMacros: () => <div data-testid="list-macros" />,
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

describe("MacroPage", () => {
  const renderPage = async (sort?: string) =>
    render(
      await Page({
        params: Promise.resolve({ locale: "en-US" }),
        searchParams: Promise.resolve({ sort }),
      }),
    );

  it("does not repeat the shell heading", async () => {
    await renderPage();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the macro list component", async () => {
    await renderPage();
    expect(screen.getByTestId("list-macros")).toBeInTheDocument();
  });

  it("fetches the default view's first page while the server renders", async () => {
    await renderPage();
    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain("listMacros");
    expect(queries).toContain('"page":1');
  });

  it("leaves a sorted view to the browser, which parses the sort itself", async () => {
    await renderPage('[{"field":"name","direction":"asc"}]');
    expect(prefetched.queries).toEqual([]);
  });
});
