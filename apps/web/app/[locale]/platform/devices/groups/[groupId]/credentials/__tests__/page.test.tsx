import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

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
  it("renders the credentials placeholder", () => {
    render(<DeviceGroupCredentialsPage />);

    expect(screen.getByText("iot.groups.comingSoon.credentials")).toBeInTheDocument();
  });
});
