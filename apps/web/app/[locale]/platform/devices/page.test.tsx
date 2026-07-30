import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import DevicesPage, { generateMetadata } from "./page";

vi.mock("@/components/iot-devices/iot-devices-table-view", () => ({
  IotDevicesTableView: () => <div data-testid="devices-table-view" />,
}));

describe("DevicesPage", () => {
  it("renders the devices table view", () => {
    render(<DevicesPage />);
    expect(screen.getByTestId("devices-table-view")).toBeInTheDocument();
  });

  it("uses the localized devices title", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "en-US" }) }),
    ).resolves.toEqual({ title: "iot.devices.title" });
  });
});
