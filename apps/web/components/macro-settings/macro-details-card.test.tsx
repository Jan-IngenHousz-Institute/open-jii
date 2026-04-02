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
  const mockMacro = {
    id: "test-macro-id",
    name: "Test Macro",
    description: "Test Description",
    language: "python" as const,
    metadata: {
      code: btoa("print('Hello World')"),
    },
  };

  const defaultProps = {
    macroId: mockMacro.id,
    initialName: mockMacro.name,
    initialDescription: mockMacro.description,
    initialLanguage: mockMacro.language,
    initialCode: mockMacro.metadata.code,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render card structure", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toBeInTheDocument();
    expect(screen.getByTestId("card-description")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("should render card titles", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.generalDescription")).toBeInTheDocument();
  });

  it("should render form fields", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("form")).toBeInTheDocument();
    expect(screen.getAllByTestId("form-field")).toHaveLength(4); // name, description, language, code
    expect(screen.getAllByTestId("form-label")).toHaveLength(3); // name, description, language (code has separate label)
  });

  it("should render form field labels", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("macroSettings.name")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.description")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.language")).toBeInTheDocument();
  });

  it("should render input fields", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("input")).toBeInTheDocument();
    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toBeInTheDocument();
  });

  it("should render language options", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("Python")).toBeInTheDocument();
    const rOption = screen.getByText("R").closest("option");
    expect(rOption).toBeInTheDocument();
    expect(rOption).toBeDisabled();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    const button = screen.getByTestId("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("macroSettings.save");
    expect(button).not.toBeDisabled();
  });
});
