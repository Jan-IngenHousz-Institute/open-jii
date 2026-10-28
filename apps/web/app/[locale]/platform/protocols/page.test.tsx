import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Page from "./page";

vi.mock("@/components/list-protocols", () => ({
  ListProtocols: () => <div data-testid="list-protocols" />,
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

describe("ProtocolPage", () => {
  const renderPage = async (
    searchParams: { sort?: string; family?: string; visibility?: string } = {},
  ) =>
    render(
      await Page({
        params: Promise.resolve({ locale: "en-US" }),
        searchParams: Promise.resolve(searchParams),
      }),
    );

  it("does not repeat the shell heading", async () => {
    await renderPage();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders the protocol list component", async () => {
    await renderPage();
    expect(screen.getByTestId("list-protocols")).toBeInTheDocument();
  });

  it("fetches the default view's first page while the server renders", async () => {
    await renderPage();
    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain("listProtocols");
    expect(queries).toContain('"page":1');
  });

  it("leaves a sorted view to the browser, which parses the sort itself", async () => {
    await renderPage({ sort: '[{"field":"name","direction":"asc"}]' });
    expect(prefetched.queries).toEqual([]);
  });

  it("leaves a family-filtered view to the browser, which parses the filter itself", async () => {
    await renderPage({ family: "ambyte" });
    expect(prefetched.queries).toEqual([]);
  });

  it("leaves a visibility-filtered view to the browser, which parses the filter itself", async () => {
    await renderPage({ visibility: "private" });
    expect(prefetched.queries).toEqual([]);
  });
});
