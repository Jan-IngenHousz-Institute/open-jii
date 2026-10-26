import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { FeedbackLinks } from "./feedback-links";

describe("FeedbackLinks", () => {
  it("links to getting help and to the feature discussions, each in a new tab", () => {
    const { container } = render(<FeedbackLinks />);

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "http://localhost:3010/guide/reference/getting-help",
      "https://github.com/Jan-IngenHousz-Institute/open-jii/discussions/new?category=ideas",
    ]);
    expect(links.every((link) => link.getAttribute("target") === "_blank")).toBe(true);
  });
});
