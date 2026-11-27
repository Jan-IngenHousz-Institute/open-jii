import { render, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrcidIdCard } from "./orcid-id-card";

const securityPath = "/en-US/platform/account/security";

describe("<OrcidIdCard />", () => {
  it("shows a connected iD as a link, with a way to manage it in Security", () => {
    const { container } = render(<OrcidIdCard orcidId="0000-0002-1825-0097" />);
    const card = within(container);

    expect(card.getByText("settings.OrcidIdCard.title")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /https:\/\/orcid\.org\// })).toHaveAttribute(
      "href",
      "https://orcid.org/0000-0002-1825-0097",
    );
    expect(
      card.getByRole("link", { name: "settings.OrcidIdCard.manageInSecurity" }),
    ).toHaveAttribute("href", securityPath);
    expect(card.queryByText("settings.OrcidIdCard.connect")).not.toBeInTheDocument();
  });

  it("offers Connect ORCID, leading to Security, when no iD is connected", () => {
    const { container } = render(<OrcidIdCard orcidId={null} />);
    const card = within(container);

    expect(card.getByText("settings.OrcidIdCard.title")).toBeInTheDocument();
    const connect = card.getByRole("link", { name: "settings.OrcidIdCard.connect" });
    expect(connect).toHaveAttribute("href", securityPath);
    expect(connect.querySelector("svg")).not.toBeInTheDocument();
    expect(card.getByText("settings.OrcidIdCard.notConnectedHelp")).toBeInTheDocument();
    expect(container.querySelector('a[href^="https://orcid.org"]')).not.toBeInTheDocument();
    expect(container.querySelector('[fill="#A6CE39"]')).not.toBeInTheDocument();
  });
});
