import { render } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import RootLayout, { metadata } from "../layout";

describe("RootLayout", () => {
  it("renders children", () => {
    // RootLayout renders <html>/<body>. In jsdom the test container is a
    // <div>, which triggers a React "cannot be a child of <div>" hydration
    // warning that's meaningless for this test.
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
    expect(metadata.title).toBe("openJII - Open-science platform");
    expect(metadata.description).toContain("Open-science platform");
  });
});
