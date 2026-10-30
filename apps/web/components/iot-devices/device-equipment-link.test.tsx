import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { DeviceEquipmentLink } from "./device-equipment-link";

const jiiId = "1beb5413-3b39-4d16-81b9-87ea686dfb45";
const jii = {
  id: jiiId,
  name: "Jan IngenHousz Institute",
  slug: "jii",
  description: null,
  visibility: "private" as const,
  role: "member" as const,
  isPersonal: false,
  memberCount: 1,
  resourceCount: 1,
};
const device = createIotDeviceDetail({
  organizationId: jiiId,
  deviceType: "ambyte",
  serialNumber: "20:6E:F1:FA:79:9C",
});

describe("DeviceEquipmentLink", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });
  it("links a JII-owned device for an actual JII member", async () => {
    server.mount(contract.organizations.listMyOrganizations, { body: [jii] });
    render(<DeviceEquipmentLink device={device} />);
    expect(
      await screen.findByRole("link", { name: "iot.devices.detail.equipmentLink" }),
    ).toHaveAttribute(
      "href",
      "https://equipment.openjii.org/assets/by-device/20%3A6E%3AF1%3AFA%3A79%3A9C",
    );
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([
    { memberships: [] },
    { memberships: [{ ...jii, id: "2ec3531a-d938-408b-ab77-6cd47ad86e59", slug: "jii-testing" }] },
    { memberships: [{ ...jii, isPersonal: true }] },
  ])("hides the link without non-personal JII membership: %j", async ({ memberships }) => {
    server.mount(contract.organizations.listMyOrganizations, { body: memberships });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<DeviceEquipmentLink device={device} />, { queryClient });
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .getAll()
          .some((query) => query.state.status === "success"),
      ).toBe(true),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    { organizationId: null },
    { organizationId: "2ec3531a-d938-408b-ab77-6cd47ad86e59" },
    { deviceType: "mobile" as const },
  ])("hides the link for other ownership and unsupported families: %j", (overrides) => {
    server.mount(contract.organizations.listMyOrganizations, { body: [jii] });
    render(<DeviceEquipmentLink device={{ ...device, ...overrides }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the link while memberships are loading", async () => {
    const request = server.mount(contract.organizations.listMyOrganizations, { delay: "infinite" });
    render(<DeviceEquipmentLink device={device} />);
    await waitFor(() => expect(request.called).toBe(true));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the link if the membership request fails", async () => {
    server.mount(contract.organizations.listMyOrganizations, { status: 500, body: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<DeviceEquipmentLink device={device} />, { queryClient });
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .getAll()
          .some((query) => query.state.status === "error"),
      ).toBe(true),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the link without a signed-in principal", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    render(<DeviceEquipmentLink device={device} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
