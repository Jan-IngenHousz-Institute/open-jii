import {
  createDeviceGroupDetail,
  createDeviceGroupMember,
  readOnlyCapabilities,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { GroupCredentialsContent } from "./group-credentials-content";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

const CERT = {
  certificateId: "c1",
  certificateArn: "arn:c1",
  certificatePem: "PEM",
  publicKey: "PUB",
  privateKey: "KEY",
};

function mountGroup(
  members: ReturnType<typeof createDeviceGroupMember>[],
  groupOverrides: Parameters<typeof createDeviceGroupDetail>[0] = {},
) {
  server.mount(contract.iot.getIotDeviceGroup, {
    body: createDeviceGroupDetail({ id: GROUP_ID, name: "Greenhouse A", ...groupOverrides }),
  });
  server.mount(contract.iot.listIotDeviceGroupMembers, { body: members });
}

describe("GroupCredentialsContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  });

  it("preselects only devices the current action applies to", async () => {
    const waiting = createDeviceGroupMember({ name: "Waiting", status: "pending" });
    mountGroup([
      waiting,
      createDeviceGroupMember({ name: "Gateway", status: "active" }),
      createDeviceGroupMember({ name: "Mid-swap", status: "rotating" }),
      createDeviceGroupMember({ name: "Phone", deviceType: "mobile" }),
    ]);
    const issue = server.mount(contract.iot.issueIotDeviceGroupCredentials, {
      body: { devices: [] },
    });

    render(<GroupCredentialsContent />);

    // Issue is the default: live certificates and phones sit out with a reason.
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(screen.getAllByText("iot.groups.credentials.hasCredentialsIneligible")).toHaveLength(2);
    expect(screen.getByText("iot.groups.credentials.mobileIneligible")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /submitIssue/ }));

    await waitFor(() => {
      expect(issue.calls).toHaveLength(1);
    });
    expect(issue.calls[0].body).toMatchObject({ deviceIds: [waiting.deviceId] });
  });

  it("re-filters and resets the selection when the action changes", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    mountGroup([
      gateway,
      createDeviceGroupMember({ name: "Waiting", status: "pending" }),
      createDeviceGroupMember({ name: "Mid-swap", status: "rotating" }),
    ]);
    const rotate = server.mount(contract.iot.rotateIotDeviceGroupCredentials, {
      body: { devices: [] },
    });

    render(<GroupCredentialsContent />);
    await screen.findByText("Gateway");

    await user.click(screen.getByRole("radio", { name: "iot.groups.credentials.actionRotate" }));

    // Only the active device rotates; the others explain themselves.
    expect(screen.getByText("iot.groups.credentials.noCertificateIneligible")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.credentials.rotatingIneligible")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submitRotate/ }));
    await user.click(screen.getByRole("button", { name: "iot.groups.credentials.actionRotate" }));

    await waitFor(() => {
      expect(rotate.calls).toHaveLength(1);
    });
    expect(rotate.calls[0].body).toMatchObject({ deviceIds: [gateway.deviceId] });
  });

  it("warns how many selected devices will disconnect before rotating", async () => {
    const user = userEvent.setup();
    mountGroup([
      createDeviceGroupMember({ name: "Gateway", status: "active", connected: true }),
      createDeviceGroupMember({ name: "Spare", status: "active", connected: false }),
    ]);

    render(<GroupCredentialsContent />);
    await screen.findByText("Gateway");

    await user.click(screen.getByRole("radio", { name: "iot.groups.credentials.actionRotate" }));
    await user.click(screen.getByRole("button", { name: /submitRotate/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("iot.groups.credentials.rotateConfirm");
    expect(dialog).toHaveTextContent("iot.groups.credentials.onlineWarning");
  });

  it("issues directly and delivers the one-time bundles", async () => {
    const user = userEvent.setup();
    const waiting = createDeviceGroupMember({ name: "Waiting", status: "pending" });
    const broken = createDeviceGroupMember({ name: "Broken", status: "revoked" });
    mountGroup([waiting, broken]);
    server.mount(contract.iot.issueIotDeviceGroupCredentials, {
      body: {
        devices: [
          { deviceId: waiting.deviceId, thingName: "ambyte_GW-1", credentials: CERT, error: null },
          { deviceId: broken.deviceId, thingName: "ambyte_GW-2", credentials: null, error: "boom" },
        ],
      },
    });

    render(<GroupCredentialsContent />);
    await screen.findByText("Waiting");

    await user.click(screen.getByRole("button", { name: /submitIssue/ }));

    // No confirmation for issuing: nothing gets disconnected.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByText("iot.devices.credentials.showOnceWarning")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iot.groups.credentials.downloadAll/ }),
    ).toBeInTheDocument();
  });

  it("revokes after confirmation and reports outcomes without downloads", async () => {
    const user = userEvent.setup();
    const gateway = createDeviceGroupMember({ name: "Gateway", status: "active" });
    mountGroup([gateway]);
    const revoke = server.mount(contract.iot.revokeIotDeviceGroupCredentials, {
      body: { devices: [{ deviceId: gateway.deviceId, error: null }] },
    });

    render(<GroupCredentialsContent />);
    await screen.findByText("Gateway");

    await user.click(screen.getByRole("radio", { name: "iot.groups.credentials.actionRevoke" }));
    await user.click(screen.getByRole("button", { name: /submitRevoke/ }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "iot.groups.credentials.actionRevoke" }));

    await waitFor(() => {
      expect(revoke.calls).toHaveLength(1);
    });
    expect(revoke.calls[0].body).toMatchObject({ deviceIds: [gateway.deviceId] });
    // Nothing to deliver after a revocation.
    expect(await screen.findByText("iot.groups.credentials.resultsTitle")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /iot.groups.credentials.downloadAll/ }),
    ).not.toBeInTheDocument();
  });

  it("sends someone below manage back to the group overview", async () => {
    mountGroup([], { capabilities: readOnlyCapabilities });

    const { container, router } = render(<GroupCredentialsContent />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/groups/${GROUP_ID}`);
    });
    expect(container).toBeEmptyDOMElement();
  });
});
