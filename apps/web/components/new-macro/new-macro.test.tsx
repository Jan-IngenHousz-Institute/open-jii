import { createMacro, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import * as base64Utils from "@/util/base64";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
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

vi.mocked(useSession).mockReturnValue({
  data: { user: { id: "user-1" } },
  isPending: false,
} as ReturnType<typeof useSession>);

describe("NewMacroForm", () => {
  it("renders form structure", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    render(<NewMacroForm />);

    expect(screen.getByTestId("details-card")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();
  });

  it("renders cancel and submit buttons", () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });
    render(<NewMacroForm />);
    expect(screen.getByText("newMacro.cancel")).toBeInTheDocument();
    expect(screen.getByText("newMacro.finalizeSetup")).toBeInTheDocument();
  });

  it("navigates back on cancel", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });
    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await user.click(screen.getByText("newMacro.cancel"));
    expect(router.back).toHaveBeenCalled();
  });

  it("submits form — POST /api/v1/macros", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

    const spy = server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-42", name: "New Macro", code: "" }),
    });

    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await user.click(screen.getByText("newMacro.finalizeSetup"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(vi.mocked(base64Utils.encodeBase64)).toHaveBeenCalled();
    expect(vi.mocked(toast)).toHaveBeenCalledWith({ description: "macros.macroCreated" });

    // onSuccess navigates to the new macro
    await waitFor(() => {
      expect(router.push).toHaveBeenCalled();
    });
  });

  it("renders code editor with default language", async () => {
    server.mount(contract.users.getUserProfile, { body: createUserProfile() });

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
