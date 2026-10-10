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

vi.mock("@/components/iot-devices/groups/device-group-layout-shell", () => ({
  DeviceGroupLayoutShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("device group layout", () => {
  it("fetches the group while the server renders, so its tab's reads start at once", async () => {
    render(await Layout({ children: <p>tab</p>, params: Promise.resolve({ groupId: "group-1" }) }));

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByText("tab")).toBeInTheDocument();
    expect(queries).toContain("getIotDeviceGroup");
    expect(queries).toContain('"groupId":"group-1"');
  });
});
