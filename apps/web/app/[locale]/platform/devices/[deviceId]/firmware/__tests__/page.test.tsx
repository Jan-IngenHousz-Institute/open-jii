import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceFirmwarePage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its firmware section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`firmware:${DEVICE_ID}`);
  });
});

describe("DeviceFirmwarePage", () => {
  it("renders the firmware surface", async () => {
    vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "ambyte" }),
    });
    server.mount(contract.iot.getDeviceFirmwareHistory, { status: 500 });
    server.mount(contract.iot.listIotFirmwareReleases, { body: { releases: [] } });

    render(<DeviceFirmwarePage />);

    expect(await screen.findByText("iot.devices.firmware.title")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.guide.title")).toBeInTheDocument();
  });
});
