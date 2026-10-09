import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import DevicesPage, { generateMetadata } from "./page";

vi.mock("@/components/iot-devices/iot-devices-table-view", () => ({
  IotDevicesTableView: () => <div data-testid="devices-table-view" />,
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

describe("DevicesPage", () => {
  it("renders the devices table view", () => {
    render(<DevicesPage />);
    expect(screen.getByTestId("devices-table-view")).toBeInTheDocument();
  });

  it("fetches the devices and groups while the server renders, not the warehouse panels", () => {
    render(<DevicesPage />);

    const queries = JSON.stringify(prefetched.queries);
    expect(queries).toContain("listIotDevices");
    expect(queries).toContain("listIotDeviceGroups");
    expect(queries).not.toContain("Monitoring");
  });

  it("uses the localized devices title", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "en-US" }) }),
    ).resolves.toEqual({ title: "iot.devices.title" });
  });
});
