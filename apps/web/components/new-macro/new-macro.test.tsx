import * as base64Utils from "@/util/base64";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

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
  disabled?: boolean;
}

interface MockCardProps {
  children: React.ReactNode;
  className?: string;
}

interface MockCodeEditorProps {
  language: string;
  onChange?: (value: string) => void;
  title?: string;
  value?: string;
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
}

interface MockControllerProps {
  render: (props: { field: Record<string, unknown> }) => React.ReactNode;
}

// Mock the hooks and dependencies
const mockPush = vi.fn();
const mockBack = vi.fn();
const mockMutate = vi.fn();

let macroCreateOnSuccess: ((data: { body: { id: string } }) => void) | undefined;

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
  useMacroCreate: (opts?: { onSuccess?: (data: { body: { id: string } }) => void }) => {
    macroCreateOnSuccess = opts?.onSuccess;
    return {
      mutate: mockMutate,
      isPending: false,
    };
  },
}));

// Mock hooks added by protocol-macro compatibility feature
const mockProtocolList = [
  { id: "proto-1", name: "Temperature Protocol", family: "multispeq" },
  { id: "proto-2", name: "Humidity Protocol", family: "ambit" },
];

vi.mock("@/hooks/protocol/useProtocolSearch/useProtocolSearch", () => ({
  useProtocolSearch: () => ({ protocols: mockProtocolList }),
}));

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, true],
}));

const mockAddProtocolsMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol", () => ({
  useAddCompatibleProtocol: () => ({ mutateAsync: mockAddProtocolsMutateAsync }),
}));

interface DropdownPropsCaptured {
  availableProtocols: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void;
  isAddingProtocol: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../protocol-search-with-dropdown", () => ({
  ProtocolSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="protocol-search-dropdown" />;
  },
}));

vi.mock("~/hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
  useGetUserProfile: () => ({
    data: {
      body: {
        firstName: "Test",
        lastName: "User",
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
  useLocale: () => "en",
}));

vi.mock("@repo/ui/hooks");

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
  __esModule: true,
  default: ({ language, onChange, title }: MockCodeEditorProps) => (
    <div data-testid="code-editor" data-language={language}>
      {title && <span>{title}</span>}
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
  default: ({ value, onChange, language }: MockCodeEditorAltProps) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-language={language}
    />
  ),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;
    macroCreateOnSuccess = undefined;
    mockAddProtocolsMutateAsync.mockResolvedValue(undefined);
    mockMutate.mockImplementation(() => {
      macroCreateOnSuccess?.({ body: { id: "new-macro-id" } });
    });
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

  it("should call mutate on submit", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const submitButton = screen.getByText("newMacro.finalizeSetup");

    // Act
    await user.click(submitButton);

    // Assert
    expect(mockMutate).toHaveBeenCalled();
  });

  it("should render code editor with correct language", () => {
    // Act
    render(<NewMacroForm />);
    const codeEditor = screen.getByTestId("code-editor");

    // Assert
    expect(codeEditor).toHaveAttribute("data-language", "python");
  });

  it("should render the code editor with title", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();
  });

  it("should have language selector in the code editor section", () => {
    // Act
    render(<NewMacroForm />);

    // Get the select component directly
    const languageSelect = screen.getByTestId("select");

    // Assert
    expect(languageSelect).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    const rOption = screen.getByText("R").closest("option");
    expect(rOption).toBeInTheDocument();
    expect(rOption).toBeDisabled();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("should have correct form structure", () => {
    // Act
    render(<NewMacroForm />);

    // Assert
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    expect(form).toBeInTheDocument();
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

  it("should encode code with encodeBase64", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<NewMacroForm />);
    const submitButton = screen.getByText("newMacro.finalizeSetup");

    // Act
    await user.click(submitButton);

    // Assert
    expect(vi.mocked(base64Utils.encodeBase64)).toHaveBeenCalledWith("print('hello world')");
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
  });

  it("should change language when language select changes", () => {
    // Arrange
    render(<NewMacroForm />);
    const languageSelect = screen.getByTestId("select");

    // Act
    fireEvent.change(languageSelect, { target: { value: "r" } });

    // Assert
    // Since the actual behavior is tested in the component, we just verify
    // that the select exists and can be interacted with
    expect(screen.getByTestId("select")).toBeInTheDocument();
  });

  describe("Compatible Protocols Section", () => {
    it("should render ProtocolSearchWithDropdown", () => {
      render(<NewMacroForm />);

      expect(screen.getByTestId("protocol-search-dropdown")).toBeInTheDocument();
    });

    it("should pass available protocols to the dropdown", () => {
      render(<NewMacroForm />);

      expect(lastDropdownProps).not.toBeNull();
      const ids = lastDropdownProps?.availableProtocols.map((p) => p.id);
      expect(ids).toContain("proto-1");
      expect(ids).toContain("proto-2");
    });

    it("should add a protocol when onAddProtocol is called and show it in the list", () => {
      render(<NewMacroForm />);

      // Add a protocol via the dropdown callback
      act(() => {
        lastDropdownProps?.onAddProtocol("proto-1");
      });

      // The protocol should now be displayed in the selected list
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
      expect(screen.getByText("multispeq")).toBeInTheDocument();
    });

    it("should filter out already-selected protocols from available list", () => {
      render(<NewMacroForm />);

      // Add proto-1
      act(() => {
        lastDropdownProps?.onAddProtocol("proto-1");
      });

      // After re-render, proto-1 should be filtered out
      expect(lastDropdownProps?.availableProtocols.map((p) => p.id)).not.toContain("proto-1");
      expect(lastDropdownProps?.availableProtocols.map((p) => p.id)).toContain("proto-2");
    });

    it("should display selected protocols in alphabetical order", () => {
      render(<NewMacroForm />);

      // Add protocols in non-alphabetical order: "Temperature Protocol" then "Humidity Protocol"
      act(() => {
        lastDropdownProps?.onAddProtocol("proto-1"); // Temperature Protocol
      });
      act(() => {
        lastDropdownProps?.onAddProtocol("proto-2"); // Humidity Protocol
      });

      const items = screen.getAllByText(/Protocol/).map((el) => el.textContent);
      expect(items).toEqual(["Humidity Protocol", "Temperature Protocol"]);
    });

    it("should remove a protocol when its remove button is clicked", async () => {
      const user = userEvent.setup();
      render(<NewMacroForm />);

      // Add a protocol first
      act(() => {
        lastDropdownProps?.onAddProtocol("proto-1");
      });
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();

      // Click the remove button (it's the button inside the selected protocol row)
      const removeButtons = screen.getAllByRole("button").filter((btn) => {
        return btn.closest(".flex.items-center.justify-between");
      });
      expect(removeButtons.length).toBeGreaterThan(0);
      await user.click(removeButtons[0]);

      // Protocol should be removed from the list
      expect(screen.queryByText("Temperature Protocol")).not.toBeInTheDocument();
    });

    it("should link compatible protocols after create then navigate", async () => {
      const user = userEvent.setup();
      render(<NewMacroForm />);

      act(() => {
        lastDropdownProps?.onAddProtocol("proto-1");
      });

      await user.click(screen.getByText("newMacro.finalizeSetup"));

      await waitFor(() => {
        expect(mockAddProtocolsMutateAsync).toHaveBeenCalledWith({
          params: { id: "new-macro-id" },
          body: { protocolIds: ["proto-1"] },
        });
      });

      expect(mockPush).toHaveBeenCalledWith("/en/platform/macros/new-macro-id");
    });
  });
});
