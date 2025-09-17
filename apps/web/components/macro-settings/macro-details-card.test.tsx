/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MacroDetailsCard } from "./macro-details-card";

// Mock MacroCodeEditor
vi.mock("../macro-code-editor", () => ({
  default: ({ value, language, macroName, onChange }: any) => (
    <div data-testid="macro-code-editor">
      <div data-testid="editor-value">{value}</div>
      <div data-testid="editor-language">{language}</div>
      <div data-testid="editor-macro-name">{macroName}</div>
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
    handleSubmit: (fn: any) => fn,
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

// Mock macro update hook
vi.mock("../../hooks/macro/useMacroUpdate/useMacroUpdate", () => ({
  useMacroUpdate: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormField: ({ render }: any) => {
    const mockField = {
      value: "print('Hello World')",
      onChange: vi.fn(),
    };
    return <div data-testid="form-field">{render({ field: mockField })}</div>;
  },
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormMessage: () => <div data-testid="form-message" />,
  Input: ({ placeholder, ...props }: any) => (
    <input data-testid="input" placeholder={placeholder} {...props} />
  ),
  RichTextarea: ({ placeholder, value, onChange }: any) => (
    <textarea
      data-testid="rich-textarea"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  Select: ({ children, onValueChange, defaultValue }: any) => (
    <select
      data-testid="select"
      onChange={(e) => onValueChange(e.target.value)}
      value={defaultValue}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <option data-testid="select-item" value={value}>
      {children}
    </option>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <div data-testid="select-value" />,
  Button: ({ children, disabled, type, ...props }: any) => (
    <button data-testid="button" disabled={disabled} type={type} {...props}>
      {children}
    </button>
  ),
}));

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MacroDetailsCard", () => {
  const mockMacro = {
    id: "test-macro-id",
    name: "Test Macro",
    description: "Test Description",
    language: "python" as const,
    metadata: {
      code: "print('Hello World')",
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
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    const button = screen.getByTestId("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("macroSettings.save");
    expect(button).not.toBeDisabled();
  });

  it("should render MacroCodeEditor", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-value")).toHaveTextContent(mockMacro.metadata.code);
    expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
    expect(screen.getByTestId("editor-macro-name")).toHaveTextContent(mockMacro.name);
  });

  it("should handle different initial values", () => {
    const props = {
      macroId: "different-id",
      initialName: "Different Macro",
      initialDescription: "Different Description",
      initialLanguage: "r" as const,
      initialCode: "library(ggplot2)",
    };

    render(<MacroDetailsCard {...props} />);

    expect(screen.getByTestId("form")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
  });
});
