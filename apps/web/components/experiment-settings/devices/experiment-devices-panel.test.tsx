import { createIotDevice } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    boundExperimentCount: source.boundExperimentCount,
  };
}

const bound: ExperimentDeviceEntry = {
  device: identity(device),
  clientId: device.thingName,
  binding: { addedBy: "22222222-2222-4222-8222-222222222222", addedAt: new Date().toISOString() },
  connectivity: { connected: true, lastSeenAt: null },
  lastDataAt: null,
  recentData: null,
  reported: null,
  canView: true,
};

const observedPhone: ExperimentDeviceEntry = {
  device: identity(phone),
  clientId: phone.thingName,
  binding: null,
  connectivity: null,
  lastDataAt: "2026-09-03T10:00:00.000Z",
  recentData: { measurementCount: 7, lastDataAt: "2026-09-03T10:00:00.000Z" },
  reported: {
    deviceName: null,
    firmware: null,
    version: "2.4.1",
    battery: 4.18,
    totalMeasurements: 42,
    lastReportedAt: "2026-09-03T10:00:00.000Z",
  },
  canView: false,
};

const unregistered: ExperimentDeviceEntry = {
  device: null,
  clientId: "cognito-abc",
  binding: null,
  connectivity: null,
  lastDataAt: null,
  recentData: { measurementCount: 3, lastDataAt: "2026-09-01T00:00:00.000Z" },
  reported: {
    deviceName: null,
    firmware: null,
    version: null,
    battery: null,
    totalMeasurements: 3,
    lastReportedAt: "2026-09-01T00:00:00.000Z",
  },
  canView: false,
};

// Same publisher, but this one told the pipeline what it calls itself.
const unregisteredNamed: ExperimentDeviceEntry = {
  ...unregistered,
  reported: {
    deviceName: "shed-logger",
    firmware: null,
    version: null,
    battery: null,
    totalMeasurements: 3,
    lastReportedAt: "2026-09-01T00:00:00.000Z",
  },
};

function overview(
  devices: ExperimentDeviceEntry[],
  pipelineUnavailable = false,
): ExperimentDevicesOverview {
  return { devices, window: WINDOW, pipelineUnavailable };
}

describe("ExperimentDevicesPanel", () => {
  beforeEach(() => {
    // The detail pane fetches a series for whichever device is selected.
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: false },
    });
  });

  it("lists bound devices, observed devices and unregistered publishers", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText("Bench sensor").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Field phone")).toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.unregistered")).toBeInTheDocument();
    expect(screen.getAllByText("cognito-abc").length).toBeGreaterThan(0);
    // The first device is selected on arrival, so the detail area is useful at once.
    expect(screen.getByText("iot.experimentDevices.openMonitoring")).toBeInTheDocument();
    // Only a bound device can be detached, and only the selected one shows the action.
    expect(screen.getAllByRole("button", { name: "iot.experimentDevices.detach" })).toHaveLength(1);
  });

  it("shows the selected device's facts and swaps them when another is picked", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    // Auto-selected: the detail pane heads with the first device.
    expect(await screen.findByRole("heading", { name: "Bench sensor" })).toBeInTheDocument();
    expect(screen.getAllByText("AA:BB").length).toBeGreaterThan(0);

    await user.click(screen.getByText("Field phone"));

    expect(await screen.findByRole("heading", { name: "Field phone" })).toBeInTheDocument();
    expect(screen.getAllByText("PH-1").length).toBeGreaterThan(0);
    // The phone is not viewable, so it offers no link out.
    expect(screen.queryByText("iot.experimentDevices.openMonitoring")).not.toBeInTheDocument();
    expect(screen.getAllByText("iot.experimentDevices.noAccess").length).toBeGreaterThan(0);
  });

  it("filters the list by search, leaving an explicitly selected device open", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await screen.findByText("Field phone");
    await user.click(
      within(screen.getByRole("list")).getByRole("button", { name: /Bench sensor/ }),
    );
    await user.type(
      screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"),
      "Field",
    );

    // Gone from the list, still in the detail pane: filtering does not deselect.
    await waitFor(() =>
      expect(within(screen.getByRole("list")).queryByText("Bench sensor")).not.toBeInTheDocument(),
    );
    expect(within(screen.getByRole("list")).getByText("Field phone")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bench sensor" })).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"));
    await user.type(screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"), "zzz");
    expect(await screen.findByText("iot.experimentDevices.searchNoMatches")).toBeInTheDocument();
  });

  it("defaults the detail pane to the first filtered and sorted row from a shared URL", async () => {
    openOnUrl(
      `/platform/experiments/${EXPERIMENT_ID}/devices`,
      `deviceFamily=mobile&q=Field&sort=${encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]))}`,
    );
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone]),
    });
    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);
    expect(await screen.findByRole("heading", { name: "Field phone" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bench sensor" })).not.toBeInTheDocument();
  });

  it("follows sorting and search until the user picks a device", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([observedPhone, bound]),
    });
    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);
    expect(await screen.findByRole("heading", { name: "Field phone" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    expect(screen.getByRole("heading", { name: "Bench sensor" })).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"),
      "missing",
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Bench sensor" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("heading", { name: "Field phone" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));
    expect(await screen.findByRole("heading", { name: "Bench sensor" })).toBeInTheDocument();
  });

  it("counts onboarded, sending, silent and unbound devices in the tiles", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    // The shared metric card puts the figure in the element right after its
    // label, so the tiles read the same way here as every other metrics band.
    const tileValue = async (label: string) =>
      (await screen.findByText(label)).nextElementSibling?.textContent;

    expect(await tileValue("iot.experimentDevices.stats.onboarded")).toBe("1");
    expect(await tileValue("iot.experimentDevices.stats.sending")).toBe("2");
    expect(await tileValue("iot.experimentDevices.stats.silent")).toBe("1");
    expect(await tileValue("iot.experimentDevices.stats.unbound")).toBe("2");
  });

  it("gives every tile a denominator, so a figure is never bare", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText("iot.experimentDevices.stats.ofTotal")).toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.stats.window")).toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.stats.ofOnboarded")).toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.stats.ofSending")).toBeInTheDocument();
  });

  it("drops the warehouse-derived denominators when the pipeline is unreachable", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, observedPhone, unregistered], true),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    // The roster size is still known, the counts it would divide are not.
    expect(await screen.findByText("iot.experimentDevices.stats.ofTotal")).toBeInTheDocument();
    expect(screen.queryByText("iot.experimentDevices.stats.ofOnboarded")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.experimentDevices.stats.ofSending")).not.toBeInTheDocument();
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
      expect(screen.getAllByText("Bench sensor").length).toBeGreaterThan(0);
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

  it("falls back to the first visible row when an explicitly selected device is detached", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([bound, unregisteredNamed, observedPhone]),
    });
    server.mount(contract.experiments.removeExperimentDevice, { status: 204, body: undefined });
    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await screen.findByRole("heading", { name: "Bench sensor" });
    await user.click(
      within(screen.getByRole("list")).getByRole("button", { name: /Bench sensor/ }),
    );
    await user.type(
      screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"),
      "Field",
    );
    await waitFor(() =>
      expect(within(screen.getByRole("list")).getAllByRole("button")).toHaveLength(1),
    );
    expect(screen.getByRole("heading", { name: "Bench sensor" })).toBeInTheDocument();

    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([unregisteredNamed, observedPhone]),
    });
    await user.click(screen.getByRole("button", { name: "iot.experimentDevices.detach" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "iot.experimentDevices.detach",
      }),
    );

    expect(await screen.findByRole("heading", { name: "Field phone" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "shed-logger" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByRole("button", { current: true }),
    ).toHaveTextContent("Field phone");
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

  it("shows the pipeline's reported facts in the detail pane: firmware, battery and totals", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([observedPhone]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("iot.experimentDevices.facts.firmware")).toBeInTheDocument();
    });
    expect(screen.getByText("2.4.1")).toBeInTheDocument();
    expect(screen.getByText("4.18")).toBeInTheDocument();
    // The window count and the all-time total are labelled apart, not merged.
    expect(screen.getByText("iot.experimentDevices.facts.inWindow")).toBeInTheDocument();
    expect(screen.getByText("iot.experimentDevices.facts.allTime")).toBeInTheDocument();
  });

  it("names an unregistered publisher by what it called itself, keeping its client id", async () => {
    server.mount(contract.experiments.listExperimentDevices, {
      body: overview([unregisteredNamed]),
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText("shed-logger").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("cognito-abc").length).toBeGreaterThan(0);
    // No registry row, so nothing links out and the lock is stated instead.
    expect(screen.queryByText("iot.experimentDevices.openMonitoring")).not.toBeInTheDocument();
  });

  it("pages a long roster instead of rendering every device at once", async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      ...unregistered,
      clientId: `publisher-${String(index)}`,
    }));
    server.mount(contract.experiments.listExperimentDevices, { body: overview(many) });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText("publisher-0").length).toBeGreaterThan(0);
    });
    // 20 to a page, matching the other resource lists.
    expect(screen.queryByText("publisher-20")).not.toBeInTheDocument();
    expect(screen.getByText("pagination.pageOf")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "pagination.next" }));

    await waitFor(() => expect(screen.getAllByText("publisher-20")).toHaveLength(2));
    expect(
      within(screen.getByRole("list")).getByRole("button", { current: true }),
    ).toHaveTextContent("publisher-20");
    expect(screen.queryByText("publisher-0")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

    expect(await screen.findByText("publisher-1")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByRole("button", { current: true }),
    ).toHaveTextContent("publisher-0");
    expect(screen.queryByText("publisher-20")).not.toBeInTheDocument();
  });
});
