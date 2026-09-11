import { createCapabilities, createDeviceGroupDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { GroupAboutCard } from "./group-about-card";

describe("GroupAboutCard", () => {
  it("names the owning organization and offers the transfer when the caller may move it", () => {
    const group = createDeviceGroupDetail({
      organizationName: "Greenhouse Lab",
      capabilities: { ...createCapabilities(), canTransfer: true },
    });

    render(<GroupAboutCard group={group} members={[]} />);

    expect(screen.getByText("organizations.owningOrganization")).toBeInTheDocument();
    expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument();
    expect(screen.getByText("organizations.transfer.action")).toBeInTheDocument();
  });

  it("still names the owner for a caller who cannot move it, without the action", () => {
    const group = createDeviceGroupDetail({
      organizationName: "Greenhouse Lab",
      capabilities: { ...createCapabilities(), canTransfer: false },
    });

    render(<GroupAboutCard group={group} members={[]} />);

    expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument();
    expect(screen.queryByText("organizations.transfer.action")).not.toBeInTheDocument();
  });
});
