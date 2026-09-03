import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentDeviceEntry,
  ExperimentDevicesOverview,
} from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentDevicesPanel } from "./experiment-devices-panel";

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const WINDOW = { from: "2026-08-04T12:00:00.000Z", to: "2026-09-03T12:00:00.000Z" };

const device = createIotDevice({ name: "Bench sensor", serialNumber: "AA:BB" });
const phone = createIotDevice({ name: "Field phone", serialNumber: "PH-1", deviceType: "mobile" });

function identity(source: typeof device) {
  return {
    id: source.id,
    thingName: source.thingName,
    serialNumber: source.serialNumber,
    name: source.name,
    deviceType: source.deviceType,
    status: source.status,
  };
}

const bound: ExperimentDeviceEntry = {
  device: identity(device),
  clientId: device.thingName,
  binding: { addedBy: "22222222-2222-4222-8222-222222222222", addedAt: new Date().toISOString() },
  connectivity: { connected: true, lastSeenAt: null },
  lastDataAt: null,
  recentData: null,
  canView: true,
};

const observedPhone: ExperimentDeviceEntry = {
  device: identity(phone),
  clientId: phone.thingName,
  binding: null,
  connectivity: null,
  lastDataAt: "2026-09-03T10:00:00.000Z",
  recentData: { measurementCount: 7, lastDataAt: "2026-09-03T10:00:00.000Z" },
  canView: false,
};

const unregistered: ExperimentDeviceEntry = {
  device: null,
  clientId: "cognito-abc",
  binding: null,
  connectivity: null,
  lastDataAt: null,
  recentData: { measurementCount: 3, lastDataAt: "2026-09-01T00:00:00.000Z" },
  canView: false,
};

function overview(
  devices: ExperimentDeviceEntry[],
  pipelineUnavailable = false,
): ExperimentDevicesOverview {
  return { devices, window: WINDOW, pipelineUnavailable };
}

describe("ExperimentDevicesPanel", () => {
  it("lists bound devices, observed devices and unregistered publishers", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Bench sensor")).toBeInTheDocument();
    });
    expect(screen.getByText("AA:BB")).toBeInTheDocument();
    // A bound device the caller may open is a link; the stranger's phone is not.
    expect(screen.getByRole("link", { name: "Bench sensor" })).toHaveAttribute(
      "href",
      expect.stringContaining(`/platform/devices/${device.id}`),
    );
    expect(screen.getByText("Field phone")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Field phone" })).not.toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.unregistered")).toBeInTheDocument();
    expect(screen.getByText("cognito-abc")).toBeInTheDocument();
    // Only a bound device can be detached.
    expect(screen.getAllByRole("button", { name: "iot.experimentDevices.detach" })).toHaveLength(1);
  });

  it("counts onboarded, sending, silent and unbound devices in the tiles", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    const tileValue = async (label: string) =>
      (await screen.findByText(label)).parentElement?.querySelector("p.text-lg")?.textContent;

    expect(await tileValue("iot.experimentDevices.stats.onboarded")).toBe("1");
    expect(await tileValue("iot.experimentDevices.stats.sending")).toBe("2");
    expect(await tileValue("iot.experimentDevices.stats.silent")).toBe("1");
    expect(await tileValue("iot.experimentDevices.stats.unbound")).toBe("2");
  });

  it("does not claim silence when the warehouse was unavailable", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound], true),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await screen.findByText("iot.experimentDevices.pipelineUnavailable");
    expect(screen.queryByText("iot.experimentDevices.noRecentData")).not.toBeInTheDocument();
    expect(screen.getAllByText("iot.experimentDevices.lastDataUnavailable").length).toBeGreaterThan(
      0,
    );
  });

  it("shows an empty state when nothing is onboarded or sending", async () => {
    server.mount(contract.experiments.listExperimentDevices, { body: overview([]) });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("iot.experimentDevices.empty")).toBeInTheDocument();
    });
  });

  it("shows an error state when the list cannot load", async () => {
    server.mount(contract.experiments.listExperimentDevices, { status: 403 });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("iot.experimentDevices.loadError")).toBeInTheDocument();
    });

    // The retry refetches; a recovered read replaces the error with the rows.
    server.mount(contract.experiments.listExperimentDevices, { body: overview([bound]) });
    await userEvent.click(screen.getByRole("button", { name: "iot.onboarding.retry" }));
    await waitFor(() => {
      expect(screen.getByText("Bench sensor")).toBeInTheDocument();
    });
  });

  it("detaches a device", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, { body: overview([bound]) });
    const spy = server.mount(contract.experiments.removeExperimentDevice, {
      status: 204,
      body: undefined,
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "iot.experimentDevices.detach" }));
    // The X only nominates; the confirm names the consequence before anything fires.
    expect(spy.called).toBe(false);
    await screen.findByText("iot.experimentDevices.detachConfirmBody");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "iot.experimentDevices.detach",
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("shows an error toast when detaching fails", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, { body: overview([bound]) });
    server.mount(contract.experiments.removeExperimentDevice, {
      status: 403,
      body: { message: "Nope" },
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "iot.experimentDevices.detach" }));
    await screen.findByText("iot.experimentDevices.detachConfirmBody");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "iot.experimentDevices.detach",
      }),
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
