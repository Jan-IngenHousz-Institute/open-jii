import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import DeviceDetailPage, { metadata } from "./page";

vi.mock("@/components/iot-devices/iot-device-detail", () => ({
  IotDeviceDetail: ({ deviceId }: { deviceId: string }) => (
    <div data-testid="device-detail">{deviceId}</div>
  ),
}));

describe("DeviceDetailPage", () => {
  it("passes the awaited deviceId param to the detail component", async () => {
    render(await DeviceDetailPage({ params: Promise.resolve({ deviceId: "dev-1" }) }));
    expect(screen.getByTestId("device-detail")).toHaveTextContent("dev-1");
  });

  it("sets the page title", () => {
    expect(metadata.title).toBe("Device");
  });
});
