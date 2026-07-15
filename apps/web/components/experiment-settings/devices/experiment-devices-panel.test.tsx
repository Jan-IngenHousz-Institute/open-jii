import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentDevicesPanel } from "./experiment-devices-panel";

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";

const device = createIotDevice({ name: "Bench sensor", serialNumber: "AA:BB" });

const binding = {
  device: {
    id: device.id,
    thingName: device.thingName,
    serialNumber: device.serialNumber,
    name: device.name,
    deviceType: device.deviceType,
    status: device.status,
  },
  addedBy: "22222222-2222-4222-8222-222222222222",
  addedAt: new Date().toISOString(),
};

describe("ExperimentDevicesPanel", () => {
  it("lists the devices onboarded to the experiment", async () => {
    server.mount(contract.experiments.listExperimentDevices, { body: [binding] });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Bench sensor")).toBeInTheDocument();
    });
    expect(screen.getByText("AA:BB")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is onboarded", async () => {
    server.mount(contract.experiments.listExperimentDevices, { body: [] });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("iot.experimentDevices.empty")).toBeInTheDocument();
    });
  });

  it("detaches a device", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, { body: [binding] });
    const spy = server.mount(contract.experiments.removeExperimentDevice, {
      status: 204,
      body: undefined,
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "iot.experimentDevices.detach" }));

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("shows an error toast when detaching fails", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperimentDevices, { body: [binding] });
    server.mount(contract.experiments.removeExperimentDevice, {
      status: 403,
      body: { message: "Nope" },
    });

    render(<ExperimentDevicesPanel experimentId={EXPERIMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "iot.experimentDevices.detach" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
