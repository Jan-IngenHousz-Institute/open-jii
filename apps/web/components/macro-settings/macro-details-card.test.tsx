import { render, screen, waitFor } from "@/test/test-utils";
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

  it("renders card with title and description", async () => {
    render(<MacroDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
    });
    expect(screen.getByText("macroSettings.generalDescription")).toBeInTheDocument();
  });

  it("renders form labels for name, description, and language", async () => {
    render(<MacroDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("macroSettings.name")).toBeInTheDocument();
    });
    expect(screen.getByText("macroSettings.description")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.language")).toBeInTheDocument();
  });

  it("renders language options", async () => {
    render(<MacroDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Python").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("renders the MacroCodeEditor with decoded initial code", async () => {
    render(<MacroDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello')");
    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("renders a save button", async () => {
    render(<MacroDetailsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /macroSettings.save/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /macroSettings.save/i })).not.toBeDisabled();
  });
});
