import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
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

  it("renders the stitched hub with the About sidebar carrying the identity facts", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        status: "active",
        serialNumber: "SN-42",
        thingName: "ambyte_SN-42",
      }),
    });

    renderPage();

    expect(
      await screen.findByText("iot.devices.detail.cards.credentialsTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("iot.devices.detail.cards.experimentsTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.detail.cards.activityTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.detail.about.title")).toBeInTheDocument();
    expect(screen.getByText("SN-42")).toBeInTheDocument();
    expect(screen.getByText("ambyte_SN-42")).toBeInTheDocument();
  });

  it("offers no delete affordance on the tab body; that action lives in the header menu", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID }),
    });

    renderPage();

    await screen.findByText("iot.devices.detail.cards.activityTitle");
    expect(
      screen.queryByRole("button", { name: "iot.devices.actions.delete" }),
    ).not.toBeInTheDocument();
  });
});
