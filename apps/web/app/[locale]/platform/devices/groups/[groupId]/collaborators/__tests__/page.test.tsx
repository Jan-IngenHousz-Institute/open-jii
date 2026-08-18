import { createDeviceGroupDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import GroupCollaboratorsContent from "../group-collaborators-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(({ groupId, section }: { groupId: string; section: string }) => ({
    title: `${section}:${groupId}`,
  })),
}));

vi.mock("@/components/sharing/resource-collaborators-route", () => ({
  ResourceCollaboratorsRoute: (props: { resourceType: string; resourceId: string }) => (
    <div data-testid="collaborators-route">
      {props.resourceType}:{props.resourceId}
    </div>
  ),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its collaborators section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", groupId: GROUP_ID }),
    });

    expect(metadata.title).toBe(`collaborators:${GROUP_ID}`);
  });
});

describe("GroupCollaboratorsContent", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ groupId: GROUP_ID });
  });

  it("mounts the generic collaborators surface for the group resource", async () => {
    server.mount(contract.deviceGroups.getDeviceGroup, {
      body: createDeviceGroupDetail({ id: GROUP_ID }),
    });

    render(<GroupCollaboratorsContent params={Promise.resolve({ groupId: GROUP_ID })} />);

    expect(await screen.findByTestId("collaborators-route")).toHaveTextContent(
      `device_group:${GROUP_ID}`,
    );
  });
});
