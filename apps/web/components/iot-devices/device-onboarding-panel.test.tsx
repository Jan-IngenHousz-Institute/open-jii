import { createExperiment, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
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
      workbookVersion: null,
      procedures: [],
    },
  ],
};

const configWithQuestion = {
  ...config,
  experiments: [
    {
      ...config.experiments[0],
      workbookVersion: 1,
      procedures: [
        {
          type: "question" as const,
          id: "c-q",
          name: "plot",
          kind: "open_ended" as const,
          text: "Which plot?",
          required: true,
          answer: null,
        },
      ],
    },
  ],
};

const fresh = createExperiment({ id: "22222222-2222-4222-8222-222222222222", name: "Fresh" });

describe("DeviceOnboardingPanel", () => {
  it("puts bound and selectable experiments in one list with one grammar", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });

    render(<DeviceOnboardingPanel device={device} />);

    // Bound rows are locked facts that link out; selectable rows are choices.
    expect(await screen.findByRole("link", { name: "Bound experiment" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("Fresh")).toBeInTheDocument();
  });

  it("shows the rail as a preview before anything is issued", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });

    render(<DeviceOnboardingPanel device={device} />);

    // The manifest exists from first paint, and admits what it cannot know yet.
    expect(await screen.findByText("iot.onboarding.rail.title")).toBeInTheDocument();
    expect(screen.getByText("iot.onboarding.rail.preview")).toBeInTheDocument();
    expect(screen.getByText("iot.onboarding.rail.resolvedWhenIssued")).toBeInTheDocument();
    expect(screen.getByText(device.thingName)).toBeInTheDocument();
  });

  it("previews a selected experiment before issuing, marked as new", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("checkbox"));

    expect(screen.getByText("iot.onboarding.rail.new")).toBeInTheDocument();
    expect(screen.getByText("iot.onboarding.rail.topicsWhenIssued")).toBeInTheDocument();
  });

  it("says why Onboard is disabled, right under the button", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });

    render(<DeviceOnboardingPanel device={device} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /iot.onboarding.onboard/ })).toBeDisabled();
    });
    expect(screen.getByText("iot.onboarding.selectAtLeastOne")).toBeInTheDocument();
  });

  it("onboards the selection and resolves the rail in place", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });
    const spy = server.mount(contract.iot.onboardDevice, { body: config });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboardCount/ }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ experimentIds: [fresh.id], includeWorkbook: true });

    await waitFor(() => {
      expect(screen.getByText(config.endpoint)).toBeInTheDocument();
    });
    expect(screen.getByText(config.experiments[0].topicPrefix)).toBeInTheDocument();
    expect(screen.queryByText("iot.onboarding.rail.preview")).not.toBeInTheDocument();
  });

  it("re-issues without a selection, which Onboard cannot do", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });
    server.mount(contract.experiments.listExperiments, { body: [] });
    const spy = server.mount(contract.iot.onboardDevice, { body: config });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("button", { name: /iot.onboarding.reissue/ }));

    await waitFor(() => expect(spy.called).toBe(true));
    // The two jobs the old single button conflated: re-issue binds nothing new.
    expect(spy.body).toEqual({ experimentIds: [], includeWorkbook: true });
  });

  it("labels the old config stale when a re-issue fails, instead of dropping it", async () => {
    const user = userEvent.setup();
    const second = createExperiment({ id: "33333333-3333-4333-8333-333333333333", name: "Second" });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh, second] });
    server.mount(contract.iot.onboardDevice, { body: config });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click((await screen.findAllByRole("checkbox"))[0]);
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboardCount/ }));
    await waitFor(() => {
      expect(screen.getByText(config.endpoint)).toBeInTheDocument();
    });

    server.mount(contract.iot.onboardDevice, { status: 403, body: { message: "Nope" } });
    await user.click((await screen.findAllByRole("checkbox"))[0]);
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboardCount/ }));

    await waitFor(() => {
      expect(screen.getByText("iot.onboarding.rail.stale")).toBeInTheDocument();
    });
    expect(screen.getByText(config.endpoint)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("sends includeWorkbook: false when the toggle is off", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });
    const spy = server.mount(contract.iot.onboardDevice, { body: config });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByLabelText("iot.onboarding.includeWorkbook"));
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboardCount/ }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ experimentIds: [fresh.id], includeWorkbook: false });
  });

  it("gates delivery on required answers and names the missing field in the rail", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });
    server.mount(contract.iot.onboardDevice, { body: configWithQuestion });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /iot.onboarding.onboardCount/ }));

    await waitFor(() => {
      expect(screen.getByText("Which plot?")).toBeInTheDocument();
    });
    // The rail names what is missing rather than a hint that names nothing.
    expect(screen.getByText("iot.onboarding.rail.missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iot.onboarding.download/ })).toBeDisabled();

    await user.type(screen.getByLabelText(/Which plot\?/), "A1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /iot.onboarding.download/ })).toBeEnabled();
    });
    expect(screen.queryByText("iot.onboarding.rail.missing")).not.toBeInTheDocument();
  });

  it("blocks onboarding for a device with no credentials and links to the fix", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [fresh] });

    render(<DeviceOnboardingPanel device={createIotDevice({ status: "pending" })} />);

    await waitFor(() => {
      expect(screen.getAllByText("iot.onboarding.inactiveDevice").length).toBeGreaterThan(0);
    });
    // The reason carries the fix, and it is mirrored into the rail.
    expect(
      screen.getAllByRole("link", { name: "iot.onboarding.inactiveDeviceAction" }).length,
    ).toBe(2);
    expect(screen.getByRole("button", { name: /iot.onboarding.onboard/ })).toBeDisabled();
  });

  it("surfaces a failed experiment list with a retry rather than an empty one", async () => {
    server.mount(contract.iot.listDeviceExperiments, { status: 500 });
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<DeviceOnboardingPanel device={device} />);

    expect(await screen.findByText("iot.onboarding.loadError")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iot.onboarding.retry" })).toBeInTheDocument();
  });

  it("says so when the viewer belongs to no experiments", async () => {
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<DeviceOnboardingPanel device={device} />);

    expect(await screen.findByText("iot.onboarding.noMemberships")).toBeInTheDocument();
  });

  it("removes a bound experiment through the row menu, after a confirm", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listDeviceExperiments, { body: [boundExperiment] });
    server.mount(contract.experiments.listExperiments, { body: [] });
    const spy = server.mount(contract.experiments.removeExperimentDevice, {
      status: 204,
      body: undefined,
    });

    render(<DeviceOnboardingPanel device={device} />);

    await user.click(await screen.findByRole("button", { name: "iot.onboarding.boundRowActions" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /iot.onboarding.removeMenuItem/ }),
    );
    // Nothing fires until the confirm names the consequence.
    expect(spy.called).toBe(false);
    await screen.findByText("iot.onboarding.removeBody");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /iot.onboarding.removeMenuItem/,
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params.deviceId).toBe(device.id);
  });
});
