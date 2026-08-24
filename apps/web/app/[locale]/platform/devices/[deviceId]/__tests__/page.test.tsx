import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceOverviewContent from "../device-overview-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId }: { deviceId: string }) => ({
    title: `device:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderPage() {
  return render(<DeviceOverviewContent params={Promise.resolve({ deviceId: DEVICE_ID })} />);
}

describe("generateMetadata", () => {
  it("builds a device-identity title from the awaited params", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`device:${DEVICE_ID}`);
  });
});

describe("DeviceOverviewPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ deviceId: DEVICE_ID });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: null, pipelineUnavailable: false },
    });
    server.mount(contract.iot.getDeviceFirmwareHistory, { body: { versions: [] } });
  });

  it("renders the device's registry metadata", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        serialNumber: "SN-42",
        thingName: "ambyte_SN-42",
      }),
    });

    renderPage();

    expect(await screen.findByText("SN-42")).toBeInTheDocument();
    expect(screen.getByText("ambyte_SN-42")).toBeInTheDocument();
  });

  it("shows live connectivity and last-seen in the registry metadata", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        connectivity: { connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" },
      }),
    });

    renderPage();

    expect(await screen.findAllByText("iot.devices.connectivity.connected")).not.toHaveLength(0);
    expect(screen.getByText("iot.devices.connectivity.onlineSince")).toBeInTheDocument();
  });

  it("shows the disconnected state with its relative last-seen", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        connectivity: { connected: false, lastSeenAt: "2026-08-13T08:00:00.000Z" },
      }),
    });

    renderPage();

    expect(await screen.findAllByText("iot.devices.connectivity.disconnected")).not.toHaveLength(0);
  });

  it("offers no delete affordance on the tab body; that action lives in the header menu", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, serialNumber: "SN-9" }),
    });

    renderPage();

    expect(await screen.findByText("SN-9")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "iot.devices.actions.delete" }),
    ).not.toBeInTheDocument();
  });
});
