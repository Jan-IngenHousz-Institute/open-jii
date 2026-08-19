import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { notFound, usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import DevicesLayout from "./layout";

const renderLayout = (children: React.ReactNode = <div>Child Content</div>) =>
  render(<DevicesLayout>{children}</DevicesLayout>);

describe("<DevicesLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
  });

  it("calls notFound when the iot-devices flag is disabled", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(notFound).toHaveBeenCalled();
  });

  it("renders nothing while the iot-devices flag is loading", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(undefined as unknown as boolean);
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
  });

  it("renders the section header and children on the list route", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    renderLayout();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("iot.devices.title");
    expect(screen.getByRole("button", { name: "iot.devices.register" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iot.devices.bulkDialog.open" })).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("opens the bulk register dialog from the section header", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices");
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    renderLayout();

    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.open" }));

    expect(await screen.findByText("iot.devices.bulkDialog.title")).toBeInTheDocument();
  });

  it("renders children only (no header) on a device detail route", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices/dev-1");
    renderLayout();

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.devices.register" })).not.toBeInTheDocument();
  });
});
