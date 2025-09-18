import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect } from "vitest";

import NewMacroPage from "../page";

// Mock the initTranslations function
vi.mock("@repo/i18n/server", () => ({
  default: vi.fn().mockResolvedValue({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "macros.newMacro": "New Macro",
        "newMacro.description": "Create a new macro for your automations",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the NewMacroForm component
vi.mock("@/components/new-macro/new-macro", () => ({
  NewMacroForm: () => <div data-testid="new-macro-form">New macro form component</div>,
}));

describe("NewMacroPage", () => {
  const mockParams = Promise.resolve({ locale: "en-US" as const });

  it("should render the page title and description", async () => {
    const result = await NewMacroPage({ params: mockParams });
    render(result);

    expect(screen.getByText("New Macro")).toBeInTheDocument();
    expect(screen.getByText("Create a new macro for your automations")).toBeInTheDocument();
  });

  it("should render the NewMacroForm component", async () => {
    const result = await NewMacroPage({ params: mockParams });
    render(result);

    expect(screen.getByTestId("new-macro-form")).toBeInTheDocument();
    expect(screen.getByText("New macro form component")).toBeInTheDocument();
  });

  it("should handle different locale", async () => {
    const germanParams = Promise.resolve({ locale: "de-DE" as const });
    const result = await NewMacroPage({ params: germanParams });
    render(result);

    // Should still render the content (mocked translations don't change)
    expect(screen.getByText("New Macro")).toBeInTheDocument();
    expect(screen.getByTestId("new-macro-form")).toBeInTheDocument();
  });

  it("should have proper page structure", async () => {
    const result = await NewMacroPage({ params: mockParams });
    render(result);

    // Check for main container exists
    const container = screen.getByText("New Macro").closest("div");
    expect(container).toBeInTheDocument();

    // Check for proper heading structure
    const heading = screen.getByText("New Macro");
    expect(heading.tagName).toBe("H3");
    expect(heading).toBeInTheDocument();

    // Check for description paragraph
    const description = screen.getByText("Create a new macro for your automations");
    expect(description.tagName).toBe("P");
    expect(description).toBeInTheDocument();
  });

  it("should render with proper accessibility structure", async () => {
    const result = await NewMacroPage({ params: mockParams });
    render(result);

    // Check that heading exists for screen readers
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("New Macro");

    // Check that form is present
    expect(screen.getByTestId("new-macro-form")).toBeInTheDocument();
  });
});
