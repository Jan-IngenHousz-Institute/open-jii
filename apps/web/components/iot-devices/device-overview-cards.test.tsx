import { createExperiment, createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

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
  beforeEach(() => {
    server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: null, pipelineUnavailable: false },
    });
    server.mount(contract.iot.getDeviceFirmwareHistory, { body: { versions: [] } });
    server.mount(contract.iot.getDeviceObservedExperiments, { body: { experiments: [] } });
    server.mount(contract.experiments.listExperiments, { body: [] });
  });

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

  it("gives a phone activity and observed experiments, and none of the certificate machinery", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: "2026-08-24T09:00:00.000Z", pipelineUnavailable: false },
    });

    render(<DeviceOverviewCards device={makeDevice({ deviceType: "mobile" })} />);

    expect(
      await screen.findByText("iot.devices.detail.cards.activityLastData"),
    ).toBeInTheDocument();
    expect(await screen.findByText("iot.devices.detail.cards.observedEmpty")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.detail.cards.credentialsTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.detail.cards.firmwareTitle")).not.toBeInTheDocument();
  });

  it("reads a phone's experiments from the warehouse: named when the viewer is a member, opaque otherwise", async () => {
    const MINE = "33333333-3333-4333-8333-333333333333";
    const THEIRS = "44444444-4444-4444-8444-444444444444";
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.iot.getDeviceObservedExperiments, {
      body: {
        experiments: [
          { experimentId: MINE, count: 42, lastAt: "2026-08-24T00:00:00.000Z" },
          { experimentId: THEIRS, count: 7, lastAt: null },
          { experimentId: null, count: 3, lastAt: null },
        ],
      },
    });
    server.mount(contract.experiments.listExperiments, {
      body: [createExperiment({ id: MINE, name: "Greenhouse pilot" })],
    });

    render(<DeviceOverviewCards device={makeDevice({ deviceType: "mobile" })} />);

    expect(await screen.findByRole("link", { name: /Greenhouse pilot/ })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${MINE}`,
    );
    expect(screen.getByText("iot.devices.monitoring.privateExperiment")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.detail.cards.observedUnattributed")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("says plainly when no data has arrived yet", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });

    render(<DeviceOverviewCards device={makeDevice()} />);

    expect(await screen.findByText("iot.devices.detail.cards.activityNoData")).toBeInTheDocument();
  });

  it("shows the reported firmware version for a managed family, linking its tab", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.iot.getDeviceFirmwareHistory, {
      body: {
        versions: [
          { version: "1.2.0", firstSeen: "a", lastSeen: "2026-08-20T00:00:00.000Z", count: 5 },
          { version: "1.3.0", firstSeen: "b", lastSeen: "2026-08-23T00:00:00.000Z", count: 9 },
        ],
      },
    });

    render(<DeviceOverviewCards device={makeDevice()} />);

    expect(await screen.findByText("1.3.0")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "iot.devices.detail.cards.firmwareLink" }),
    ).toHaveAttribute("href", `/en-US/platform/devices/${DEVICE_ID}/firmware`);
  });
});
