import { createIotDeviceDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceCredentialsPage from "../device-credentials-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderPage() {
  return render(<DeviceCredentialsPage params={Promise.resolve({ deviceId: DEVICE_ID })} />);
}

describe("generateMetadata", () => {
  it("titles the route by its credentials section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`credentials:${DEVICE_ID}`);
  });
});

describe("DeviceCredentialsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ deviceId: DEVICE_ID });
  });

  it("offers the certificate lifecycle to someone who may manage the device", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, status: "pending" }),
    });

    renderPage();

    expect(
      await screen.findByRole("button", { name: "iot.devices.credentials.issue" }),
    ).toBeInTheDocument();
  });

  it("tells someone below manage the surface is closed, rather than bouncing them", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        status: "pending",
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderPage();

    // The tab is disabled for them, so reaching this route means a typed or
    // shared URL. Say why it is closed instead of silently moving them.
    expect(await screen.findByText("errors.noAccess.title.device")).toBeInTheDocument();
    // And no control renders: issuing, rotating and revoking all reach real AWS
    // IoT and are refused server-side, so there must be no button to press.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends a mobile device back to the overview even for a manager, there is no cert lifecycle", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "mobile", status: "active" }),
    });

    const { container, router } = renderPage();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not redirect while the capabilities are still unknown", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID }),
      delay: 999_999,
    });

    const { router } = renderPage();

    // "Not yet loaded" must not read as "nothing to show here" — that would bounce
    // every legitimate visit off the route before its own device arrived.
    await waitFor(() => expect(router.replace).not.toHaveBeenCalled());
  });
});
