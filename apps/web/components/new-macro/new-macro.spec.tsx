import { render, screen, fireEvent, userEvent } from "@/test/test-utils";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import { NewMacroForm } from "./new-macro";

// Type definitions for mock components
interface MockFormProps {
  children: React.ReactNode;
  [key: string]: unknown;
}

interface MockButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  [key: string]: unknown;
}

interface MockFormFieldProps {
  name: string;
  render: (props: {
    field: { name: string; value: string; onChange: () => void };
    fieldState: Record<string, unknown>;
  }) => React.ReactNode;
}

interface MockInputProps {
  placeholder?: string;
  [key: string]: unknown;
}

interface MockLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

interface MockTextareaProps {
  placeholder?: string;
  rows?: number;
  [key: string]: unknown;
}

interface MockSelectProps {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

interface MockSelectItemProps {
  value: string;
  children: React.ReactNode;
}

interface MockCardProps {
  children: React.ReactNode;
  className?: string;
}

interface MockCodeEditorProps {
  language: string;
  onChange?: (value: string) => void;
  macroName?: string;
}

interface MockNewMacroDetailsCardProps {
  form: {
    setValue: (name: string, value: string) => void;
  };
}

interface MockCodeEditorAltProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  macroName?: string;
}

interface MockControllerProps {
  render: (props: { field: Record<string, unknown> }) => React.ReactNode;
}

// Mock the hooks and dependencies
const mockPush = vi.fn();
const mockBack = vi.fn();
const mockMutate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

const sessionUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: sessionUserId } },
  }),
}));

vi.mock("~/hooks/macro/useMacroCreate/useMacroCreate", () => ({
  useMacroCreate: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Create a mock implementation for useGetUserProfile
// Using an object for state so we can modify its properties
const mockState = {
  isLoading: false,
  userProfileData: {
    body: {
      firstName: "Test",
      lastName: "User",
    },
  },
};

vi.mock("~/hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
  useGetUserProfile: () => ({
    data: mockState.isLoading ? undefined : { body: mockState.userProfileData.body },
    isLoading: mockState.isLoading,
  }),
}));

vi.mock("@repo/ui/hooks");
const mockToast = vi.mocked(toast);

vi.mock("@repo/ui/components", () => ({
  Form: ({ children, ...props }: MockFormProps) => <div {...props}>{children}</div>,
  Button: ({ children, onClick, type, disabled, ...props }: MockButtonProps) => (
    <button onClick={onClick} type={type} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  FormField: ({ name, render }: MockFormFieldProps) => {
    return (
      <div data-testid="form-field">
        {render({ field: { name, value: "", onChange: vi.fn() }, fieldState: {} })}
      </div>
    );
  },
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-item">{children}</div>
  ),
  FormLabel: ({ children }: { children: React.ReactNode }) => (
    <label data-testid="form-label">{children}</label>
  ),
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormMessage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-message">{children}</div>
  ),
  Input: ({ placeholder, ...props }: MockInputProps) => (
    <input data-testid="input" placeholder={placeholder} {...props} />
  ),
  Label: ({ children, htmlFor }: MockLabelProps) => <label htmlFor={htmlFor}>{children}</label>,
  Textarea: ({ placeholder, rows, ...props }: MockTextareaProps) => (
    <textarea data-testid="textarea" placeholder={placeholder} rows={rows} {...props} />
  ),
  RichTextarea: ({ placeholder, ...props }: MockTextareaProps) => (
    <textarea data-testid="rich-textarea" placeholder={placeholder} {...props} />
  ),
  Select: ({ children, onValueChange }: MockSelectProps) => (
    <select data-testid="select" onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: MockSelectItemProps) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  Card: ({ children, className }: MockCardProps) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="card-title">{children}</h2>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="card-description">{children}</p>
  ),
  CardContent: ({ children, className }: MockCardProps) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("../macro-code-editor", () => ({
  __esModule: true,
  default: ({ language, onChange, macroName }: MockCodeEditorProps & { macroName?: string }) => (
    <div data-testid="code-editor" data-language={language} data-macro-name={macroName}>
      <textarea
        data-testid="code-textarea"
        placeholder={`Enter ${language} code here...`}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));
vi.mock("./new-macro-details-card", () => ({
  NewMacroDetailsCard: ({ form }: MockNewMacroDetailsCardProps) => (
    <div data-testid="details-card">
      <input data-testid="name-input" onChange={(e) => form.setValue("name", e.target.value)} />
      <textarea
        data-testid="description-input"
        onChange={(e) => form.setValue("description", e.target.value)}
      />
    </div>
  ),
}));

vi.mock("../components/macro-code-editor", () => ({
  __esModule: true,
  default: ({ value, onChange, language, macroName }: MockCodeEditorAltProps) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-language={language}
      data-macro-name={macroName}
    />
  ),
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    handleSubmit: (fn: (data: Record<string, string>) => void) => (e: Event) => {
      e.preventDefault();
      fn({
        name: "Test Macro",
        description: "Test Description",
        language: "python",
        code: "print('hello world')",
      });
    },
    setValue: vi.fn(),
    watch: (key?: string) => {
      if (key === "name") return "Test Macro";
      if (key === "language") return "python";
      return "python"; // Default fallback value
    },
    formState: { errors: {} },
    control: {},
  }),
  Controller: ({ render }: MockControllerProps) => render({ field: {} }),
}));

// Mock zod resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => vi.fn(),
}));

describe("NewMacroForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock btoa globally
    global.btoa = vi.fn((str) => Buffer.from(str).toString("base64"));
  });

  it("should render form elements", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.getByTestId("details-card")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();
  });

  it("should render form buttons", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.getByText("newMacro.cancel")).toBeInTheDocument();
    expect(screen.getByText("newMacro.finalizeSetup")).toBeInTheDocument();
  });

  it("should call router.back when cancel button is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const cancelButton = screen.getByText("newMacro.cancel");

    // Act
    await user.click(cancelButton);

    // Assert
    expect(mockBack).toHaveBeenCalled();
  });

  it("should submit form with base64 encoded code", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const submitButton = screen.getByText("newMacro.finalizeSetup");

    // Act
    await user.click(submitButton);

    // Assert
    expect(mockMutate).toHaveBeenCalledWith({
      body: {
        name: "Test Macro",
        description: "Test Description",
        language: "python",
        code: Buffer.from("print('hello world')").toString("base64"),
      },
    });
  });

  it("should show toast notification on submit", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const submitButton = screen.getByText("newMacro.finalizeSetup");

    // Act
    await user.click(submitButton);

    // Assert
    expect(mockToast).toHaveBeenCalledWith({
      description: "macros.macroCreated",
    });
  });

  it("should render code editor with correct language", () => {
    // Act
    render(<NewMacroForm />);
    const codeEditor = screen.getByTestId("code-editor");

    // Assert
    expect(codeEditor).toHaveAttribute("data-language", "python");
  });

  it("should pass macro name to code editor for filename display", () => {
    // Act
    render(<NewMacroForm />);
    const codeEditor = screen.getByTestId("code-editor");

    // Assert
    // The mock form in useForm returns "Test Macro" as the name value
    expect(codeEditor).toHaveAttribute("data-macro-name", "Test Macro");
  });

  it("should have language selector in the code editor section", () => {
    // Act
    render(<NewMacroForm />);

    // Get the select component directly
    const languageSelect = screen.getByTestId("select");

    // Assert
    expect(languageSelect).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("should have correct form structure", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    expect(form).toHaveClass("space-y-8");
  });

  it("should display code section title", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();
  });

  it("should have proper button layout", () => {
    // Act
    render(<NewMacroForm />);
    const buttonsContainer = screen.getByText("newMacro.cancel").parentElement;

    // Assert
    expect(buttonsContainer).toHaveClass("flex", "gap-2");
  });

  it("should encode code with btoa", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const submitButton = screen.getByText("newMacro.finalizeSetup");

    // Act
    await user.click(submitButton);

    // Assert
    expect(global.btoa).toHaveBeenCalledWith("print('hello world')");
  });

  it("should handle form submission correctly", () => {
    // Arrange
    render(<NewMacroForm />);
    const form = document.querySelector("form");

    // Act
    if (form) {
      fireEvent.submit(form);
    }

    // Assert
    expect(mockMutate).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalled();
  });

  it("should show loading skeletons when user profile is loading", () => {
    // Set the mock to return isLoading: true for this test
    mockState.isLoading = true;

    // Act
    render(<NewMacroForm />);

    // Assert
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();

    // Reset for other tests
    mockState.isLoading = false;
  });

  it("should show code editor when user profile is loaded", () => {
    // Make sure loading state is false
    mockState.isLoading = false;

    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
  });
});
