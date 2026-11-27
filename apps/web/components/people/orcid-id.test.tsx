import { render, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrcidIdLink, orcidRecordUrl } from "./orcid-id";

const orcidId = "0000-0002-1825-0097";
const recordUrl = "https://orcid.org/0000-0002-1825-0097";

describe("orcidRecordUrl", () => {
  it("builds the full record address", () => {
    expect(orcidRecordUrl("0000-0002-9079-593X")).toBe("https://orcid.org/0000-0002-9079-593X");
  });
});

describe("<OrcidIdLink />", () => {
  it("shows the full record URL as both the text and the address", () => {
    const { container } = render(<OrcidIdLink orcidId={orcidId} />);
    const link = within(container).getByRole("link");

    expect(link).toHaveAttribute("href", recordUrl);
    expect(link).toHaveTextContent(recordUrl);
  });

  it("opens the record in a new tab", () => {
    const { container } = render(<OrcidIdLink orcidId={orcidId} />);
    const link = within(container).getByRole("link");

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names the link by the icon and the visible URL, with no aria-label", () => {
    const { container } = render(<OrcidIdLink orcidId={orcidId} />);
    const link = within(container).getByRole("link");

    expect(link).not.toHaveAttribute("aria-label");
    expect(link).toHaveAccessibleName(`settings.OrcidIdCard.iconLabel ${recordUrl}`);
  });

  it("holds ORCID's icon: a green disc with white letters", () => {
    const { container } = render(<OrcidIdLink orcidId={orcidId} />);
    const link = within(container).getByRole("link");
    const icon = within(link).getByRole("img", { name: "settings.OrcidIdCard.iconLabel" });

    expect(icon.querySelector('path[fill="#A6CE39"]')).toBeInTheDocument();
    expect(icon.querySelector('g[fill="#FFFFFF"]')).toBeInTheDocument();
  });
});
