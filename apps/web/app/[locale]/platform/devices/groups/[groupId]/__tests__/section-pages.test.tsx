import { createDeviceGroupDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { use } from "react";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import GroupCollaboratorsContent from "../collaborators/group-collaborators-content";
import { generateMetadata as collaboratorsMetadata } from "../collaborators/page";
import DeviceGroupCredentialsPage, {
  generateMetadata as credentialsMetadata,
} from "../credentials/page";
import DeviceGroupMonitoringPage, {
  generateMetadata as monitoringMetadata,
} from "../monitoring/page";
import DeviceGroupOnboardingPage, {
  generateMetadata as onboardingMetadata,
} from "../onboarding/page";
import { generateMetadata as overviewMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceGroupMetadata: vi.fn(
    ({ groupId, section }: { groupId: string; section?: string }) => ({
      title: `${section ?? "overview"}:${groupId}`,
    }),
  ),
}));

vi.mock("@/components/sharing/resource-collaborators-route", () => ({
  ResourceCollaboratorsRoute: (props: { resourceType: string; resourceId: string }) => (
    <div data-testid="collaborators-route">
      {props.resourceType}:{props.resourceId}
    </div>
  ),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("device group section pages", () => {
  it("renders each placeholder section with its own promise copy", () => {
    render(
      <>
        <DeviceGroupCredentialsPage />
        <DeviceGroupOnboardingPage />
        <DeviceGroupMonitoringPage />
      </>,
    );

    for (const section of ["credentials", "onboarding", "monitoring"]) {
      expect(screen.getByText(`iot.groups.comingSoon.${section}`)).toBeInTheDocument();
    }
  });

  it("mounts the generic collaborators surface for the group resource", async () => {
    vi.mocked(use).mockReturnValue({ groupId: GROUP_ID });
    server.mount(contract.deviceGroups.getDeviceGroup, {
      body: createDeviceGroupDetail({ id: GROUP_ID }),
    });

    render(<GroupCollaboratorsContent params={Promise.resolve({ groupId: GROUP_ID })} />);

    expect(await screen.findByTestId("collaborators-route")).toHaveTextContent(
      `device_group:${GROUP_ID}`,
    );
  });

  it("delegates every route title to the group metadata builder", async () => {
    const params = Promise.resolve({ locale: "en-US", groupId: GROUP_ID });

    await expect(overviewMetadata({ params })).resolves.toEqual({
      title: `overview:${GROUP_ID}`,
    });
    await expect(collaboratorsMetadata({ params })).resolves.toEqual({
      title: `collaborators:${GROUP_ID}`,
    });
    await expect(credentialsMetadata({ params })).resolves.toEqual({
      title: `credentials:${GROUP_ID}`,
    });
    await expect(onboardingMetadata({ params })).resolves.toEqual({
      title: `onboarding:${GROUP_ID}`,
    });
    await expect(monitoringMetadata({ params })).resolves.toEqual({
      title: `monitoring:${GROUP_ID}`,
    });
  });
});
