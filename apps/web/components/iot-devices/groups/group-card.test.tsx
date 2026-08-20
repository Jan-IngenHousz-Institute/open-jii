import { createIotDeviceGroup } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { GroupCard } from "./group-card";

describe("GroupCard", () => {
  it("renders name, description, and member count", () => {
    const group = createIotDeviceGroup({
      name: "Greenhouse A",
      description: "North wing sensors",
      memberCount: 3,
    });

    render(<GroupCard group={group} locale="en-US" />);

    expect(screen.getByText("Greenhouse A")).toBeInTheDocument();
    expect(screen.getByText("North wing sensors")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.memberCount")).toBeInTheDocument();
  });

  it("omits the description paragraph when there is none", () => {
    const group = createIotDeviceGroup({ name: "Field campaign", description: null });

    render(<GroupCard group={group} locale="en-US" />);

    const card = screen.getByRole("link");
    expect(card.querySelectorAll("p")).toHaveLength(2);
  });

  it("links to the group detail route", () => {
    const group = createIotDeviceGroup();

    render(<GroupCard group={group} locale="en-US" />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/en-US/platform/devices/groups/${group.id}`,
    );
  });
});
