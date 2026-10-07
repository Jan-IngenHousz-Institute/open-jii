import { createSession } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { auth } from "~/app/actions/auth";
import { orpc } from "~/lib/orpc";

import Layout from "./layout";

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

vi.mock("@/components/experiment-overview/experiment-archive-layout-shell", () => ({
  ExperimentArchiveLayoutShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("experiment layout", () => {
  it("fetches the signed-in user's access to this experiment while the server renders", async () => {
    const session = createSession();
    vi.mocked(auth).mockResolvedValue(session);

    render(await Layout({ children: <p>tab</p>, params: Promise.resolve({ id: "experiment-1" }) }));

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByText("tab")).toBeInTheDocument();
    expect(queries).toContain("getExperimentAccess");
    expect(queries).toContain('"id":"experiment-1"');
    expect(queries).toContain(`"principal":"${session.user.id}"`);
  });
});
