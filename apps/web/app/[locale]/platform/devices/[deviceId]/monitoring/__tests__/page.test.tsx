import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceMonitoringContent from "../device-monitoring-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
});

describe("generateMetadata", () => {
  it("titles the route by its monitoring section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`monitoring:${DEVICE_ID}`);
  });
});

describe("DeviceMonitoringPage", () => {
  it("shows live connectivity and the pipeline-computed last data arrival", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        connectivity: { connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" },
      }),
    });
    server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: new Date(Date.now() - 10 * 60_000).toISOString() },
    });

    render(<DeviceMonitoringContent />);

    expect(await screen.findByText("iot.devices.connectivity.connected")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.connectivity.connectedNow")).toBeInTheDocument();
    expect(screen.getByText(/10 minutes ago/)).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.pipelineNote")).toBeInTheDocument();
  });

  it("degrades to unknown and no-data when both sources are unavailable", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, connectivity: null }),
    });
    server.mount(contract.iot.getIotDeviceActivity, { body: { lastDataAt: null } });

    render(<DeviceMonitoringContent />);

    expect(await screen.findAllByText("iot.devices.connectivity.unknown")).not.toHaveLength(0);
    expect(screen.getByText("iot.devices.monitoring.noData")).toBeInTheDocument();
  });
});
