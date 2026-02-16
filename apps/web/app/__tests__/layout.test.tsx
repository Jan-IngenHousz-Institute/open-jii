import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import RootLayout, { metadata } from "../layout";

// Mock the PostHogProvider to avoid environment variable dependencies
vi.mock("../../providers/PostHogProvider", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("RootLayout Component", () => {
  it("should render children correctly", () => {
    const mockChildren = <div data-testid="test-child">Test Content</div>;
    const { getByTestId } = render(<RootLayout>{mockChildren}</RootLayout>);
    expect(getByTestId("test-child")).toBeInTheDocument();
  });

  it("should render basic structure", () => {
    const { container } = render(
      <RootLayout>
        <div>test</div>
      </RootLayout>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("should handle empty children", () => {
    const { container } = render(<RootLayout>{null}</RootLayout>);
    expect(container).toBeInTheDocument();
  });

  it("should handle multiple children", () => {
    const { container } = render(
      <RootLayout>
        <div>child1</div>
        <div>child2</div>
      </RootLayout>,
    );
    expect(container).toBeInTheDocument();
  });

  it("should export metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("openJII - Open-science platform");
    expect(metadata.description).toBe(
      "Open-science platform by the Jan Ingenhousz Institute for real-time analysis and visualization of photosynthesis data from IoT sensors, enabling collaborative plant science research.",
    );
  });
});
