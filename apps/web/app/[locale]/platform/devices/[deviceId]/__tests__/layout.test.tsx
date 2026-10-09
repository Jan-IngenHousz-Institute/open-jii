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

vi.mock("@/components/iot-devices/device-layout-shell", () => ({
  DeviceLayoutShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("device layout", () => {
  it("fetches the device while the server renders, so its tab's reads start at once", async () => {
    render(
      await Layout({ children: <p>tab</p>, params: Promise.resolve({ deviceId: "device-1" }) }),
    );

    const queries = JSON.stringify(prefetched.queries);
    expect(screen.getByText("tab")).toBeInTheDocument();
    expect(queries).toContain("getIotDevice");
    expect(queries).toContain('"deviceId":"device-1"');
  });
});
