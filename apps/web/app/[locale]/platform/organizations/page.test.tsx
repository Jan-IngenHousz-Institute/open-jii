import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { auth } from "~/app/actions/auth";
import { orpc } from "~/lib/orpc";

import OrganizationsPage from "./page";

vi.mock("./organizations-list-content", () => ({
  default: () => <div data-testid="organizations-list" />,
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

describe("OrganizationsPage", () => {
  const renderPage = async (searchParams: { q?: string; sort?: string } = {}) => {
    vi.mocked(auth).mockResolvedValue(createSession({ user: { id: "user-ana" } }));
    render(
      await OrganizationsPage({
        params: Promise.resolve({ locale: "en-US" }),
        searchParams: Promise.resolve(searchParams),
      }),
    );
  };

  it("renders the list without repeating the shell heading or subtitle", async () => {
    await renderPage();

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.listDescription")).not.toBeInTheDocument();
    expect(screen.getByTestId("organizations-list")).toBeInTheDocument();
  });

  it("fetches the person's directory while the server renders", async () => {
    await renderPage();

    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain("listOrganizations");
    expect(queries).toContain("user-ana");
  });

  it("leaves a searched or sorted view to the browser", async () => {
    await renderPage({ q: "lab" });
    expect(prefetched.queries).toEqual([]);

    await renderPage({ sort: '[{"field":"name","direction":"asc"}]' });
    expect(prefetched.queries).toEqual([]);
  });
});
