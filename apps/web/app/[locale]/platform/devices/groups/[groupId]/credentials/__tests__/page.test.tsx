import { createDeviceGroupDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceGroupCredentialsPage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(({ groupId, section }: { groupId: string; section: string }) => ({
    title: `${section}:${groupId}`,
  })),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its credentials section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", groupId: GROUP_ID }),
    });

    expect(metadata.title).toBe(`credentials:${GROUP_ID}`);
  });
});

describe("DeviceGroupCredentialsPage", () => {
  it("renders the live credential lifecycle surface", async () => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
    server.mount(contract.iot.getIotDeviceGroup, {
      body: createDeviceGroupDetail({ id: GROUP_ID }),
    });
    server.mount(contract.iot.listIotDeviceGroupMembers, { body: [] });

    render(<DeviceGroupCredentialsPage />);

    expect(await screen.findByText("iot.groups.credentials.title")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.noMembers")).toBeInTheDocument();
  });
});
