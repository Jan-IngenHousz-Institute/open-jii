import { createIotDeviceDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound, useParams, usePathname } from "next/navigation";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceLayout from "../layout";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function renderLayout(children: React.ReactNode = <div>Child Content</div>) {
  vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
  return render(<DeviceLayout>{children}</DeviceLayout>);
}

const tabHref = (name: string) => screen.getByRole("tab", { name }).getAttribute("href");

describe("<DeviceLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the device identity and a route-linked strip once loaded", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, name: "Field Sensor", status: "active" }),
    });

    renderLayout();

    expect(await screen.findByRole("heading", { name: "Field Sensor" })).toBeInTheDocument();
    // Every tab is a link, so each is a place with a URL and a working back button.
    expect(tabHref("iot.devices.detailTabs.overview")).toBe(`/en-US/platform/devices/${DEVICE_ID}`);
    expect(tabHref("iot.devices.detailTabs.collaborators")).toBe(
      `/en-US/platform/devices/${DEVICE_ID}/collaborators`,
    );
    expect(tabHref("iot.devices.detailTabs.credentials")).toBe(
      `/en-US/platform/devices/${DEVICE_ID}/credentials`,
    );
    expect(tabHref("iot.devices.detailTabs.lineage")).toBe(
      `/en-US/platform/devices/${DEVICE_ID}/lineage`,
    );
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("titles a nameless device through the shared identity hierarchy", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        name: null,
        deviceType: "ambyte",
        serialNumber: "SN-77",
      }),
    });

    renderLayout();

    // `name` is optional, so the title falls through to the serial number, the
    // same hierarchy the registry rows use, not a heading of its own.
    expect(await screen.findByRole("heading", { name: "SN-77" })).toBeInTheDocument();
  });

  it("hides the Collaborators tab from a reader who can neither share nor leave", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, capabilities: readOnlyCapabilities }),
    });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Child Content")).toBeInTheDocument());
    expect(
      screen.queryByRole("tab", { name: "iot.devices.detailTabs.collaborators" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the Collaborators tab for a grantee who can only leave", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderLayout();

    expect(
      await screen.findByRole("tab", { name: "iot.devices.detailTabs.collaborators" }),
    ).toBeInTheDocument();
  });

  it("hides the Credentials tab below manage — every action on it reaches AWS", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Child Content")).toBeInTheDocument());
    expect(
      screen.queryByRole("tab", { name: "iot.devices.detailTabs.credentials" }),
    ).not.toBeInTheDocument();
  });

  it("hides Credentials and Onboarding for a mobile device, phones carry neither", async () => {
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, deviceType: "mobile", status: "active" }),
    });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Child Content")).toBeInTheDocument());
    expect(
      screen.queryByRole("tab", { name: "iot.devices.detailTabs.credentials" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "iot.devices.detailTabs.onboarding" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "iot.devices.detailTabs.monitoring" }),
    ).toBeInTheDocument();
  });

  it("highlights no tab when the route the caller is on has been filtered out", async () => {
    // Demoted while sitting on /credentials: the tab is gone, and the strip must not
    // claim Overview is the current page while the URL still says /credentials.
    vi.mocked(usePathname).mockReturnValue(`/en-US/platform/devices/${DEVICE_ID}/credentials`);
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({
        id: DEVICE_ID,
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderLayout();

    const overview = await screen.findByRole("tab", { name: "iot.devices.detailTabs.overview" });
    expect(overview).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("tab", { selected: true })).not.toBeInTheDocument();
  });

  it("highlights the tab the URL names when it is still visible", async () => {
    vi.mocked(usePathname).mockReturnValue(`/en-US/platform/devices/${DEVICE_ID}/credentials`);
    server.mount(contract.iot.getIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID }),
    });

    renderLayout();

    expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(
      "iot.devices.detailTabs.credentials",
    );
  });

  it("calls notFound on a 404 and renders no strip", async () => {
    server.mount(contract.iot.getIotDevice, { status: 404 });

    renderLayout();

    await waitFor(() => expect(vi.mocked(notFound)).toHaveBeenCalled());
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("surfaces a server error instead of the device", async () => {
    server.mount(contract.iot.getIotDevice, { status: 500 });

    renderLayout();

    await waitFor(() => expect(screen.getByTestId("error-display")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });
});
