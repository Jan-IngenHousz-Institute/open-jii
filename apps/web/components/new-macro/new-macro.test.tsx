import * as base64Utils from "@/util/base64";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { toast } from "@repo/ui/hooks";

import { NewMacroForm } from "./new-macro";

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

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
  SelectItem: ({ value, children, disabled }: MockSelectItemProps) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
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
}));

vi.mock("../macro-code-editor", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="code-editor" data-language={String(props.language)}>
      {props.title != null && <div>{String(props.title as string)}</div>}
    </div>
  ),
}));

vi.mocked(useSession).mockReturnValue({
  data: { user: { id: "user-1" } },
  isPending: false,
} as ReturnType<typeof useSession>);

// Mock react-hook-form
vi.mock("react-hook-form", () => {
  const mockSetValue = vi.fn();
  const mockWatch = vi.fn().mockImplementation((key?: string) => {
    if (key === "name") return "Test Macro";
    if (key === "language") return "python";
    if (key === "code") return "print('hello world')";
    return "python"; // Default fallback value
  });

  return {
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
      setValue: mockSetValue,
      watch: mockWatch,
      formState: { errors: {} },
      control: {},
    }),
    Controller: ({ render }: MockControllerProps) => render({ field: {} }),
  };
});

// Mock zod resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => vi.fn(),
}));

// Mock base64 utilities
vi.mock("@/util/base64", () => ({
  encodeBase64: vi.fn((str: string) => Buffer.from(str).toString("base64")),
  decodeBase64: vi.fn((str: string) => Buffer.from(str, "base64").toString()),
}));

describe("NewMacroForm", () => {
  it("renders form structure", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

  it("should render form elements", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.getByTestId("details-card")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
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
});
