import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import DeviceDetailPage, { generateMetadata } from "./page";

vi.mock("@/components/iot-devices/iot-device-detail", () => ({
  IotDeviceDetail: ({ deviceId }: { deviceId: string }) => (
    <div data-testid="device-detail">{deviceId}</div>
  ),
}));

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId }: { deviceId: string }) => ({
    title: `device:${deviceId}`,
  })),
}));

describe("DeviceDetailPage", () => {
  it("passes the awaited deviceId param to the detail component", async () => {
    render(
      await DeviceDetailPage({ params: Promise.resolve({ locale: "en-US", deviceId: "dev-1" }) }),
    );
    expect(screen.getByTestId("device-detail")).toHaveTextContent("dev-1");
  });

  it("builds a device-identity title from the awaited params", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: "dev-1" }),
    });
    expect(metadata.title).toBe("device:dev-1");
  });
});
