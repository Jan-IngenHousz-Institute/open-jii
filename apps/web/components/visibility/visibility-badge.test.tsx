import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { VisibilityBadge } from "./visibility-badge";

describe("<VisibilityBadge />", () => {
  it("labels a private resource", () => {
    render(<VisibilityBadge visibility="private" />);
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });

  it("labels a public resource", () => {
    render(<VisibilityBadge visibility="public" />);
    expect(screen.getByText("resourceVisibility.publicStatus")).toBeInTheDocument();
  });

  it("renders nothing for a public resource in privateOnly mode", () => {
    const { container } = render(<VisibilityBadge visibility="public" privateOnly />);
    // List rows only flag the exception; public is the unremarkable default.
    expect(container).toBeEmptyDOMElement();
  });

  it("still flags a private resource in privateOnly mode", () => {
    render(<VisibilityBadge visibility="private" privateOnly />);
    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });
});
