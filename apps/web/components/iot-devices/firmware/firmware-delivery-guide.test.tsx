import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { FirmwareDeliveryGuide } from "./firmware-delivery-guide";

// jsdom does not implement navigator.clipboard; user-event installs its own on
// setup(), so the assertion below reads the clipboard back rather than spying.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

describe("FirmwareDeliveryGuide", () => {
  it("explains that rollouts are started by JII, not from this page", async () => {
    const user = userEvent.setup();
    render(<FirmwareDeliveryGuide />);

    await user.click(screen.getByText("iot.devices.firmware.guide.title"));

    expect(screen.getByText("iot.devices.firmware.guide.intro")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.guide.step1")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.firmware.guide.step4")).toBeInTheDocument();
  });

  it("copies the job document example and confirms it", async () => {
    const user = userEvent.setup();
    render(<FirmwareDeliveryGuide />);

    await user.click(screen.getByText("iot.devices.firmware.guide.title"));
    await user.click(screen.getByRole("button", { name: "common.copy" }));

    expect(await screen.findByRole("button", { name: "common.copied" })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toContain(
      '"operation": "firmware-update"',
    );
  });
});
