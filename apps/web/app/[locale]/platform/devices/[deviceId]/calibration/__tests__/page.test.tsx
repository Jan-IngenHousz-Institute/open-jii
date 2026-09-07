import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceCalibrationPage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its calibration section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`calibration:${DEVICE_ID}`);
  });
});

describe("DeviceCalibrationPage", () => {
  it("renders the calibration surface", async () => {
    vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "minipar" }),
    });
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });
    server.mount(contract.iot.listDeviceCalibrationRuns, { body: [] });

    render(<DeviceCalibrationPage />);

    expect(await screen.findByText("iot.calibration.title")).toBeInTheDocument();
    expect(await screen.findByText("iot.calibration.active.none")).toBeInTheDocument();
  });
});
