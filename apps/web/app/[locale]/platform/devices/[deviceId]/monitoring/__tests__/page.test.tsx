import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import DeviceMonitoringContent from "../device-monitoring-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its monitoring section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`monitoring:${DEVICE_ID}`);
  });
});

describe("DeviceMonitoringPage", () => {
  it("names the tab it stands in for, so the placeholder is not ambiguous", () => {
    render(<DeviceMonitoringContent />);

    expect(screen.getByText("iot.devices.comingSoon.monitoring")).toBeInTheDocument();
  });
});
