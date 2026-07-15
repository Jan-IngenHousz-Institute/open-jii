import { createExperiment, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceOnboardingPanel } from "./device-onboarding-panel";

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

const device = createIotDevice({ deviceType: "ambyte", status: "active" });

const boundExperiment = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bound experiment",
  status: "active" as const,
  addedAt: new Date().toISOString(),
};

const config = {
  thingName: device.thingName,
  deviceType: device.deviceType,
  endpoint: "abc-ats.iot.eu-central-1.amazonaws.com",
  experiments: [
    {
      experimentId: boundExperiment.id,
      experimentName: "Fresh experiment",
      topicPrefix: `experiment/data_ingest/v1/${boundExperiment.id}/ambyte`,
      workbook: null,
    },
  ],
};

describe("DeviceOnboardingPanel", () => {
  it("lists the experiments the device already serves", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<DeviceOnboardingPanel device={device} />);

    await waitFor(() => {
      expect(screen.getByText("Bound experiment")).toBeInTheDocument();
    });
  });

  it("shows empty states when nothing is bound or selectable", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<DeviceOnboardingPanel device={device} />);

    await waitFor(() => {
      expect(screen.getByText("iot.onboarding.currentEmpty")).toBeInTheDocument();
    });
    expect(screen.getByText("iot.onboarding.addEmpty")).toBeInTheDocument();
  });

  it("excludes already-bound experiments from the selectable list", async () => {
    const fresh = createExperiment({ id: "22222222-2222-4222-8222-222222222222", name: "Fresh" });
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });
    server.mount(contract.experiments.listExperiments, {
      body: [createExperiment({ id: boundExperiment.id, name: "Bound experiment" }), fresh],
    });

    render(<DeviceOnboardingPanel device={device} />);

    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Fresh")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bound experiment")).not.toBeInTheDocument();
  });

  it("onboards the selected experiments and renders the returned config", async () => {
    const user = userEvent.setup();
    const fresh = createExperiment({ id: "22222222-2222-4222-8222-222222222222", name: "Fresh" });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });
    const spy = server.mount(contract.iot.onboardDevice, { body: config });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByLabelText("Fresh"));
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboard/ }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ experimentIds: [fresh.id] });

    await waitFor(() => {
      expect(screen.getByText(config.endpoint)).toBeInTheDocument();
    });
    expect(screen.getByText(config.experiments[0].topicPrefix)).toBeInTheDocument();
  });

  it("shows an error toast when onboarding fails", async () => {
    const user = userEvent.setup();
    const fresh = createExperiment({ id: "22222222-2222-4222-8222-222222222222", name: "Fresh" });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });
    server.mount(contract.iot.onboardDevice, { status: 403, body: { message: "Nope" } });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByLabelText("Fresh"));
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboard/ }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
