import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceGroupMonitoringPage, { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(({ groupId, section }: { groupId: string; section: string }) => ({
    title: `${section}:${groupId}`,
  })),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its monitoring section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", groupId: GROUP_ID }),
    });

    expect(metadata.title).toBe(`monitoring:${GROUP_ID}`);
  });
});

describe("DeviceGroupMonitoringPage", () => {
  it("renders the live group health surface", async () => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
    server.mount(contract.experiments.listExperiments, { body: [] });
    server.mount(contract.iot.getIotDeviceGroupMonitoring, {
      body: {
        members: [],
        throughput: [],
        dataByExperiment: [],
        firmware: [],
        events: [],
        pipelineUnavailable: false,
      },
    });

    render(<DeviceGroupMonitoringPage />);

    expect(await screen.findByText("iot.groups.noMembers")).toBeInTheDocument();
  });
});
