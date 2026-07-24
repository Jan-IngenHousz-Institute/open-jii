import { render } from "@/test/test-utils";
import { afterEach, describe, it, expect, vi } from "vitest";

import RootLayout, { metadata } from "../layout";

describe("RootLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children", () => {
    // RootLayout renders <html>/<body> inside jsdom's <div>, which logs a
    // hydration warning. Silence it for this test.
    vi.spyOn(console, "error").mockImplementation(() => {
      // no-op
    });

    const container = document.createElement("div");
    document.body.appendChild(container);

    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="child">Content</div>
      </RootLayout>,
      { container },
    );

    expect(getByTestId("child")).toBeInTheDocument();
    document.body.removeChild(container);
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toEqual({
      default: "openJII - Open-science platform",
      template: "%s | openJII",
    });
    expect(metadata.description).toContain("Open-science platform");
    expect(metadata.openGraph).toMatchObject({
      siteName: "openJII",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
