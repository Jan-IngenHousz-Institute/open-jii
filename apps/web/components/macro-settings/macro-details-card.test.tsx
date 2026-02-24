import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MacroDetailsCard } from "./macro-details-card";

interface MockMacroCodeEditorProps {
  value: string;
  language: string;
  label?: string;
  error?: string;
  onChange: (value: string) => void;
}

interface MockFieldProps {
  field: {
    value: string;
    onChange: (value: string) => void;
  };
}

interface MockFormFieldProps {
  render: (props: MockFieldProps) => React.ReactNode;
}

interface MockSelectProps {
  children: React.ReactNode;
  onValueChange: (value: string) => void;
  defaultValue?: string;
}

interface MockButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  [key: string]: unknown;
}

interface MockRichTextareaProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

// Mock MacroCodeEditor
vi.mock("../macro-code-editor", () => ({
  default: ({ value, language, onChange }: MockMacroCodeEditorProps) => (
    <div data-testid="macro-code-editor">
      <div data-testid="editor-value">{value}</div>
      <div data-testid="editor-language">{language}</div>
      <textarea
        data-testid="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: (data: Record<string, unknown>) => void) => fn,
    formState: { errors: {} },
    watch: (field: string) => {
      if (field === "language") return "python";
      if (field === "name") return "Test Macro";
      return "";
    },
  }),
}));

// Mock zod resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(),
}));

// Mock schema
vi.mock("@/util/schema", () => ({
  editMacroFormSchema: {
    pick: () => ({
      safeParse: vi.fn(),
    }),
  },
}));

// Mock base64 utilities
vi.mock("@/util/base64", () => ({
  decodeBase64: (s: string) => {
    try {
      return atob(s);
    } catch {
      return "";
    }
  },
  encodeBase64: (s: string) => btoa(s),
}));

// Mock macro update hook
vi.mock("../../hooks/macro/useMacroUpdate/useMacroUpdate", () => ({
  useMacroUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

  it("should render MacroCodeEditor", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello World')"); // Should show decoded value
    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
  });

  it("should handle different initial values", () => {
    const props = {
      macroId: "different-id",
      initialName: "Different Macro",
      initialDescription: "Different Description",
      initialLanguage: "r" as const,
      initialCode: btoa("library(ggplot2)"),
    };

    render(<MacroDetailsCard {...props} />);

    expect(screen.getByTestId("form")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
  });
});
