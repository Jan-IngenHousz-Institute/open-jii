import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MacroDetailsCard } from "./macro-details-card";

// Mock Monaco-dependent editor — can't render in jsdom
vi.mock("../macro-code-editor", () => ({
  default: ({
    value,
    language,
    macroName,
  }: {
    value: string;
    language: string;
    macroName: string;
  }) => (
    <div data-testid="macro-code-editor">
      <span data-testid="editor-value">{value}</span>
      <span data-testid="editor-language">{language}</span>
      <span data-testid="editor-name">{macroName}</span>
    </div>
  ),
}));

const defaultProps = {
  macroId: "test-macro-id",
  initialName: "Test Macro",
  initialDescription: "A description",
  initialLanguage: "python" as const,
  initialCode: btoa("print('Hello')"),
};

describe("MacroDetailsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders card with title and description", () => {
    render(<MacroDetailsCard {...defaultProps} />);
    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.generalDescription")).toBeInTheDocument();
  });

  it("renders form labels for name, description, and language", () => {
    render(<MacroDetailsCard {...defaultProps} />);
    expect(screen.getByText("macroSettings.name")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.description")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.language")).toBeInTheDocument();
  });

  it("renders language options", () => {
    render(<MacroDetailsCard {...defaultProps} />);
    // Python appears in both the trigger (selected value) and dropdown
    expect(screen.getAllByText("Python").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("renders the MacroCodeEditor with decoded initial code", () => {
    render(<MacroDetailsCard {...defaultProps} />);
    expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello')");
    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("renders a save button", () => {
    render(<MacroDetailsCard {...defaultProps} />);
    const button = screen.getByRole("button", { name: /macroSettings.save/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});
