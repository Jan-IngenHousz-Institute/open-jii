import { createDeviceGroupDetail, createDeviceGroupMember } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceGroupPage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(({ groupId }: { groupId: string }) => ({
    title: `overview:${groupId}`,
  })),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the overview through the group metadata builder", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", groupId: GROUP_ID }),
    });

    expect(metadata.title).toBe(`overview:${GROUP_ID}`);
  });
});

describe("DeviceGroupPage", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  });

  it("renders the group overview roster", async () => {
    server.mount(contract.deviceGroups.getDeviceGroup, {
      body: createDeviceGroupDetail({ id: GROUP_ID }),
    });
    server.mount(contract.deviceGroups.listDeviceGroupMembers, {
      body: [createDeviceGroupMember({ name: "Gateway One" })],
    });
    server.mount(contract.iot.listIotDevices, { body: [] });

    render(<DeviceGroupPage />);

    expect(await screen.findByText("Gateway One")).toBeInTheDocument();
  });
});
