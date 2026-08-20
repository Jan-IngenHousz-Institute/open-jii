import {
  createDeviceGroupDetail,
  createDeviceGroupMember,
  createExperiment,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { GroupOnboardingContent } from "./group-onboarding-content";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function deviceConfig(
  thingName: string,
  experimentNames: string[] = [],
  procedures: object[] = [],
) {
  return {
    thingName,
    deviceType: "ambyte",
    endpoint: "data.iot.example.amazonaws.com",
    experiments: experimentNames.map((experimentName, index) => ({
      experimentId: `33333333-3333-4333-8333-33333333333${String(index)}`,
      experimentName,
      topicPrefix: "experiment/data_ingest/v1/x/ambyte",
      workbookVersion: null,
      procedures,
    })),
  };
}

function mountGroup(members: ReturnType<typeof createDeviceGroupMember>[]) {
  server.mount(contract.iot.getIotDeviceGroup, {
    body: createDeviceGroupDetail({ id: GROUP_ID, name: "Greenhouse A" }),
  });
  server.mount(contract.iot.listIotDeviceGroupMembers, { body: members });
  server.mount(contract.experiments.listExperiments, {
    body: [createExperiment({ name: "Field trial" })],
  });
}

describe("GroupOnboardingContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  });

  it("preselects eligible devices and marks ineligible ones", async () => {
    mountGroup([
      createDeviceGroupMember({ name: "Gateway", status: "active" }),
      createDeviceGroupMember({ name: "Waiting", status: "pending" }),
      createDeviceGroupMember({ name: "Phone", deviceType: "mobile" }),
    ]);

    render(<GroupOnboardingContent />);

    expect(await screen.findByText("Gateway")).toBeInTheDocument();
    // 1 of 3: only the active non-phone counts as selected.
    expect(screen.getByText("iot.groups.onboarding.devicesSelected")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.inactiveIneligible")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.mobileIneligible")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }),
    ).toBeInTheDocument();
  });

  it("onboards the selection and offers the config zip", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    const broken = createDeviceGroupMember({ name: "Broken", status: "active" });
    mountGroup([gateway, broken]);
    const onboard = server.mount(contract.iot.onboardIotDeviceGroup, {
      body: {
        devices: [
          {
            deviceId: gateway.deviceId,
            config: deviceConfig("ambyte_GW-1", ["Field trial", "Soil study"]),
            error: null,
          },
          { deviceId: broken.deviceId, config: null, error: "no live credentials" },
        ],
      },
    });

    render(<GroupOnboardingContent />);

    await user.click(await screen.findByText("Field trial"));
    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }));

    await vi.waitFor(() => {
      expect(onboard.calls).toHaveLength(1);
    });
    expect(onboard.calls[0].body).toMatchObject({
      deviceIds: [gateway.deviceId, broken.deviceId],
      includeWorkbook: true,
    });

    // Per-device outcomes: the failure inline, the zip only counting successes,
    // and each success naming everything the device now serves.
    expect(await screen.findByText("no live credentials")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.boundNote")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.serves")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iot.groups.onboarding.downloadAll/ }),
    ).toBeInTheDocument();
  });

  it("keeps deselected devices out of the batch", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    const spare = createDeviceGroupMember({ name: "Spare", status: "active" });
    mountGroup([gateway, spare]);
    const onboard = server.mount(contract.iot.onboardIotDeviceGroup, {
      body: { devices: [{ deviceId: gateway.deviceId, config: null, error: null }] },
    });

    render(<GroupOnboardingContent />);

    await user.click(await screen.findByText("Spare"));
    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }));

    await vi.waitFor(() => {
      expect(onboard.calls).toHaveLength(1);
    });
    expect(onboard.calls[0].body).toMatchObject({ deviceIds: [gateway.deviceId] });
  });

  it("collects plan answers once and gates delivery on required ones", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    mountGroup([gateway]);
    server.mount(contract.iot.onboardIotDeviceGroup, {
      body: {
        devices: [
          {
            deviceId: gateway.deviceId,
            config: deviceConfig(
              "ambyte_GW-1",
              ["Field trial"],
              [
                {
                  type: "question",
                  id: "q-1",
                  label: "Plot number",
                  required: true,
                  answer: null,
                },
              ],
            ),
            error: null,
          },
        ],
      },
    });

    render(<GroupOnboardingContent />);

    await user.click(await screen.findByText("Field trial"));
    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }));

    // A required unanswered question blocks delivery, never the onboarding.
    expect(await screen.findByText("iot.onboarding.questionsTitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iot.groups.onboarding.downloadAll/ }),
    ).toBeDisabled();
  });

  it("collects required questions from every device's config, not only the first", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    const spare = createDeviceGroupMember({ name: "Spare", status: "active" });
    mountGroup([gateway, spare]);
    server.mount(contract.iot.onboardIotDeviceGroup, {
      body: {
        devices: [
          {
            deviceId: gateway.deviceId,
            config: deviceConfig(
              "ambyte_GW-1",
              ["Field trial"],
              [
                {
                  type: "question",
                  id: "q-1",
                  name: "row_number",
                  kind: "open_ended",
                  text: "Row number",
                  required: false,
                  answer: null,
                },
              ],
            ),
            error: null,
          },
          {
            deviceId: spare.deviceId,
            config: deviceConfig(
              "ambyte_GW-2",
              ["Soil study"],
              [
                {
                  type: "question",
                  id: "q-2",
                  name: "plot_number",
                  kind: "open_ended",
                  text: "Plot number",
                  required: true,
                  answer: null,
                },
              ],
            ),
            error: null,
          },
        ],
      },
    });

    render(<GroupOnboardingContent />);

    await user.click(await screen.findByText("Field trial"));
    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }));

    // The second device's required question gates delivery for the whole batch.
    expect(await screen.findByText(/Plot number/)).toBeInTheDocument();
    expect(screen.getByText(/Row number/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iot.groups.onboarding.downloadAll/ }),
    ).toBeDisabled();
  });

  it("blocks a selection past the batch cap with a visible limit message", async () => {
    mountGroup(
      Array.from({ length: 101 }, (_, index) =>
        createDeviceGroupMember({ name: `Node ${String(index)}`, status: "active" }),
      ),
    );

    render(<GroupOnboardingContent />);

    expect(await screen.findByText("Node 0")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.overCap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ })).toBeDisabled();
  });

  it("allows exactly the batch cap", async () => {
    mountGroup(
      Array.from({ length: 100 }, (_, index) =>
        createDeviceGroupMember({ name: `Node ${String(index)}`, status: "active" }),
      ),
    );

    render(<GroupOnboardingContent />);

    expect(await screen.findByText("Node 0")).toBeInTheDocument();
    expect(screen.queryByText("iot.groups.onboarding.overCap")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ })).toBeEnabled();
  });

  it("supports reselecting a previously deselected device", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    mountGroup([gateway]);
    const onboard = server.mount(contract.iot.onboardIotDeviceGroup, {
      body: { devices: [] },
    });

    render(<GroupOnboardingContent />);

    // Off, then back on: the selection round-trips.
    await user.click(await screen.findByText("Gateway"));
    await user.click(screen.getByText("Gateway"));
    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.onboard/ }));

    await vi.waitFor(() => {
      expect(onboard.calls).toHaveLength(1);
    });
    expect(onboard.calls[0].body).toMatchObject({ deviceIds: [gateway.deviceId] });
  });
});
