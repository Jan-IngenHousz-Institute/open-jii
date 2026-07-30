import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import CookieSettingsLayout, { metadata } from "./layout";

describe("CookieSettingsLayout", () => {
  it("keeps the crawlable utility page out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });

    render(
      <CookieSettingsLayout>
        <div>Cookie settings</div>
      </CookieSettingsLayout>,
    );
    expect(screen.getByText("Cookie settings")).toBeInTheDocument();
  });
});
