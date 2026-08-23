import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceOverviewCards } from "./device-overview-cards";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const boundExperiment = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Soil Health",
  status: "active" as const,
  addedAt: new Date().toISOString(),
};

function makeDevice(overrides: Parameters<typeof createIotDeviceDetail>[0] = {}) {
  return createIotDeviceDetail({ id: DEVICE_ID, status: "active", ...overrides });
}

describe("DeviceOverviewCards", () => {
  it("links each card into the tab it summarises", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });

    render(<DeviceOverviewCards device={makeDevice()} />);

    expect(
      await screen.findByRole("link", { name: "iot.devices.detail.cards.manageLink" }),
    ).toHaveAttribute("href", `/en-US/platform/devices/${DEVICE_ID}/credentials`);
    expect(
      screen.getByRole("link", { name: "iot.devices.detail.cards.onboardLink" }),
    ).toHaveAttribute("href", `/en-US/platform/devices/${DEVICE_ID}/onboarding`);
  });

  it("lists bound experiments as links with a streaming chip", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });

    render(<DeviceOverviewCards device={makeDevice()} />);

    const link = await screen.findByRole("link", { name: "Soil Health" });
    expect(link).toHaveAttribute("href", `/en-US/platform/experiments/${boundExperiment.id}`);
    expect(screen.getByText("iot.devices.detail.cards.streaming")).toBeInTheDocument();
  });

  it("describes the credential state in plain words", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });

    render(<DeviceOverviewCards device={makeDevice({ status: "revoked" })} />);

    expect(
      await screen.findByText("iot.devices.detail.cards.credentialHint.revoked"),
    ).toBeInTheDocument();
  });

  it("hides the manage link from a viewer who cannot manage", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    const device = makeDevice();
    device.capabilities = { ...device.capabilities, canManage: false };

    render(<DeviceOverviewCards device={device} />);

    expect(
      await screen.findByText("iot.devices.detail.cards.credentialsTitle"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "iot.devices.detail.cards.manageLink" }),
    ).not.toBeInTheDocument();
  });

  it("says so when the device streams nowhere yet", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });

    render(<DeviceOverviewCards device={makeDevice()} />);

    expect(
      await screen.findByText("iot.devices.detail.cards.experimentsEmpty"),
    ).toBeInTheDocument();
  });

  it("surfaces a failed experiment read with a retry, never an empty list", async () => {
    server.mount(contract.iot.listDeviceExperiments, { status: 500 });

    render(<DeviceOverviewCards device={makeDevice()} />);

    expect(
      await screen.findByText("iot.devices.detail.cards.experimentsError"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iot.onboarding.retry" })).toBeInTheDocument();
  });
});
