import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceGroupOnboardingPage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(({ groupId, section }: { groupId: string; section: string }) => ({
    title: `${section}:${groupId}`,
  })),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its onboarding section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", groupId: GROUP_ID }),
    });

    expect(metadata.title).toBe(`onboarding:${GROUP_ID}`);
  });
});

describe("DeviceGroupOnboardingPage", () => {
  it("renders the live group onboarding surface", async () => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
    server.mount(contract.iot.getIotDeviceGroup, { status: 404 });
    server.mount(contract.iot.listIotDeviceGroupMembers, { body: [] });
    server.mount(contract.experiments.listExperiments, { body: [] });

    render(<DeviceGroupOnboardingPage />);

    expect(await screen.findByText("iot.groups.onboarding.title")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.noMembers")).toBeInTheDocument();
  });
});
