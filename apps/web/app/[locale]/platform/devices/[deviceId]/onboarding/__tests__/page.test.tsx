import { createIotDeviceDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceOnboardingContent from "../device-onboarding-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderPage() {
  return render(<DeviceOnboardingContent params={Promise.resolve({ deviceId: DEVICE_ID })} />);
}

describe("generateMetadata", () => {
  it("titles the route by its onboarding section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`onboarding:${DEVICE_ID}`);
  });
});

describe("DeviceOnboardingPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ deviceId: DEVICE_ID });
  });

  it("offers onboarding to someone who may manage the device", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, status: "active" }),
    });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    renderPage();

    expect(await screen.findByText("iot.onboarding.currentEmpty")).toBeInTheDocument();
  });

  it("sends a mobile device back to the overview, the app manages its own config", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "mobile", status: "active" }),
    });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    const { container, router } = renderPage();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("sends someone below manage back to the device instead of a blank route", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        status: "active",
        capabilities: { ...readOnlyCapabilities },
      }),
    });

    const { container, router } = renderPage();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(`/en-US/platform/devices/${DEVICE_ID}`);
    });
    expect(container).toBeEmptyDOMElement();
  });
});
