import { createIotDeviceDetail, createResourceGrant, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import DeviceCollaboratorsPage from "../page";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderPage() {
  return render(<DeviceCollaboratorsPage params={Promise.resolve({ deviceId: DEVICE_ID })} />);
}

describe("DeviceCollaboratorsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ deviceId: DEVICE_ID });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("shows the collaborators surface to someone who may share the device", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID }),
    });
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          resourceType: "device",
          resourceId: DEVICE_ID,
          grantee: { type: "user", displayName: "Lin Zhao", email: "lin@uni.edu", avatarUrl: null },
        }),
      ],
    });

    const { router } = renderPage();

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("gives a grantee below share only the leave card, and never fetches the roster", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });
    const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

    renderPage();

    await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sharing.invite/ })).not.toBeInTheDocument();
    expect(listSpy.called).toBe(false);
  });

  it("sends a viewer with no sharing surface back to the device", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, capabilities: readOnlyCapabilities }),
    });

    const { container, router } = renderPage();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`),
    );
    // Nothing is rendered on the way out — no empty surface, no lone heading.
    expect(container).toBeEmptyDOMElement();
  });
});
