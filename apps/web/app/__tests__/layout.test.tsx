import { render } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import RootLayout, { metadata } from "../layout";

describe("RootLayout", () => {
  it("renders children", () => {
    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="child">Content</div>
      </RootLayout>,
    );

    expect(getByTestId("child")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toBe("openJII - Open-science platform");
    expect(metadata.description).toContain("Open-science platform");
  });
});
