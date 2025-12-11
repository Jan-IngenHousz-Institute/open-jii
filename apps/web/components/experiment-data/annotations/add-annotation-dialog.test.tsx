import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { AnnotationType } from "@repo/api";

import { AddAnnotationDialog } from "./add-annotation-dialog";

// Hoisted mocks
const mockAddAnnotation = vi.hoisted(() => vi.fn());
const mockAddAnnotationsBulk = vi.hoisted(() => vi.fn());
const useExperimentAnnotationAddMock = vi.hoisted(() => vi.fn());
const useExperimentAnnotationAddBulkMock = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

// Mock i18n to return translation keys
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

// Mock API - including proper zod schema
vi.mock("@repo/api", () => ({
  zAnnotationContent: {
    parse: vi.fn((data: unknown) => data),
    safeParse: vi.fn((data: unknown) => ({ success: true, data })),
  },
}));

// Mock react-hook-form resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

// Mock UI components to avoid nested form issues
vi.mock("@repo/ui/components", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <div>{children}</div>,
  Form: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="form" {...props}>
      {children}
    </div>
  ),
  FormField: ({
    render,
    name,
  }: {
    render: (props: { field: { value: string; onChange: () => void } }) => React.ReactNode;
    name: string;
  }) => {
    const field = {
      value: name === "flagType" ? "outlier" : "",
      onChange: vi.fn(),
    };
    return render({ field });
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormMessage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    type,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} type={type} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Textarea: ({
    onChange,
    value,
    placeholder,
    rows,
    ...props
  }: {
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    value?: string;
    placeholder?: string;
    rows?: number;
    [key: string]: unknown;
  }) => (
    <textarea onChange={onChange} value={value} placeholder={placeholder} rows={rows} {...props} />
  ),
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <div data-testid="select">
      <input
        data-testid="select-input"
        type="hidden"
        value={value ?? "outlier"}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

// Mock the hooks
vi.mock(
  "~/hooks/experiment/annotations/useExperimentAnnotationAdd/useExperimentAnnotationAdd",
  () => ({
    useExperimentAnnotationAdd: useExperimentAnnotationAddMock,
  }),
);

vi.mock(
  "~/hooks/experiment/annotations/useExperimentAnnotationAddBulk/useExperimentAnnotationAddBulk",
  () => ({
    useExperimentAnnotationAddBulk: useExperimentAnnotationAddBulkMock,
  }),
);

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit:
      (fn: (data: { type: string; text: string }) => void) =>
      (e?: { preventDefault?: () => void }) => {
        e?.preventDefault?.();
        fn({ type: "comment", text: "Test comment" });
      },
    reset: vi.fn(),
  }),
}));

const mockProps = {
  experimentId: "exp-123",
  tableName: "test-table",
  rowIds: ["1", "2", "3"],
  type: "comment" as AnnotationType,
  open: true,
  setOpen: vi.fn(),
  clearSelection: vi.fn(),
};

describe("AddAnnotationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExperimentAnnotationAddMock.mockReturnValue({
      mutateAsync: mockAddAnnotation,
      isPending: false,
    });
    useExperimentAnnotationAddBulkMock.mockReturnValue({
      mutateAsync: mockAddAnnotationsBulk,
      isPending: false,
    });
  });

  it("should render dialog for comment type", () => {
    render(<AddAnnotationDialog {...mockProps} />);

    expect(
      screen.getByText("experimentDataAnnotations.commentDialogBulk.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText('experimentDataAnnotations.commentDialogBulk.description:{"count":3}'),
    ).toBeInTheDocument();
  });

  it("should render dialog for single comment", () => {
    render(<AddAnnotationDialog {...mockProps} rowIds={["1"]} />);

    expect(screen.getByText("experimentDataAnnotations.commentDialog.title")).toBeInTheDocument();
    expect(
      screen.getByText('experimentDataAnnotations.commentDialog.description:{"count":1}'),
    ).toBeInTheDocument();
  });

  it("should render dialog for flag type", () => {
    render(<AddAnnotationDialog {...mockProps} type="flag" />);

    expect(screen.getByText("experimentDataAnnotations.flagDialogBulk.title")).toBeInTheDocument();
    expect(
      screen.getByText('experimentDataAnnotations.flagDialogBulk.description:{"count":3}'),
    ).toBeInTheDocument();
  });

  it("should show flag type selector for flag annotations", () => {
    render(<AddAnnotationDialog {...mockProps} type="flag" />);

    expect(screen.getByText("experimentDataAnnotations.flagType")).toBeInTheDocument();
    expect(screen.getAllByText("experimentDataAnnotations.flagTypes.outlier")).toHaveLength(1);
  });

  it("should not show flag type selector for comment annotations", () => {
    render(<AddAnnotationDialog {...mockProps} type="comment" />);

    expect(screen.queryByText("experimentDataAnnotations.flagType")).not.toBeInTheDocument();
  });

  it("should render text input with correct label for comments", () => {
    render(<AddAnnotationDialog {...mockProps} type="comment" />);

    expect(
      screen.getByText("experimentDataAnnotations.commentDialogBulk.textLabel"),
    ).toBeInTheDocument();
  });

  it("should render text input with correct label for flags", () => {
    render(<AddAnnotationDialog {...mockProps} type="flag" />);

    expect(screen.getByText("experimentDataAnnotations.flagReason")).toBeInTheDocument();
  });

  it("should show cancel and submit buttons", () => {
    render(<AddAnnotationDialog {...mockProps} />);

    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(
      screen.getByText('experimentDataAnnotations.commentDialogBulk.add:{"count":3}'),
    ).toBeInTheDocument();
  });

  it("should call single annotation API for single row", async () => {
    mockAddAnnotation.mockResolvedValue({});

    render(<AddAnnotationDialog {...mockProps} rowIds={["1"]} />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.commentDialog.add:{"count":1}',
    );
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAddAnnotation).toHaveBeenCalledWith({
        params: { id: "exp-123" },
        body: {
          tableName: "test-table",
          rowId: "1",
          annotation: {
            type: "comment",
            content: { type: "comment", text: "Test comment" },
          },
        },
      });
    });
  });

  it("should call bulk annotation API for multiple rows", async () => {
    mockAddAnnotationsBulk.mockResolvedValue({});

    render(<AddAnnotationDialog {...mockProps} />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.commentDialogBulk.add:{"count":3}',
    );
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAddAnnotationsBulk).toHaveBeenCalledWith({
        params: { id: "exp-123" },
        body: {
          tableName: "test-table",
          rowIds: ["1", "2", "3"],
          annotation: {
            type: "comment",
            content: { type: "comment", text: "Test comment" },
          },
        },
      });
    });
  });

  it("should handle flag annotation submission", async () => {
    mockAddAnnotationsBulk.mockResolvedValue({});

    render(<AddAnnotationDialog {...mockProps} type="flag" />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.flagDialogBulk.add:{"count":3}',
    );
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAddAnnotationsBulk).toHaveBeenCalledWith({
        params: { id: "exp-123" },
        body: {
          tableName: "test-table",
          rowIds: ["1", "2", "3"],
          annotation: {
            type: "flag",
            content: {
              type: "comment",
              text: "Test comment",
            },
          },
        },
      });
    });
  });

  it("should show toast and close dialog after successful submission", async () => {
    mockAddAnnotationsBulk.mockResolvedValue({});

    render(<AddAnnotationDialog {...mockProps} />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.commentDialogBulk.add:{"count":3}',
    );
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.updated",
      });
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
      expect(mockProps.clearSelection).toHaveBeenCalled();
    });
  });

  it("should reset form after successful submission", async () => {
    mockAddAnnotationsBulk.mockResolvedValue({});

    render(<AddAnnotationDialog {...mockProps} />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.commentDialogBulk.add:{"count":3}',
    );
    fireEvent.click(submitButton);

    await waitFor(() => {
      // After successful submission, dialog should be available for use
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
    });
  });

  it("should reset form when type changes", () => {
    const { rerender } = render(<AddAnnotationDialog {...mockProps} type="comment" />);

    rerender(<AddAnnotationDialog {...mockProps} type="flag" />);

    // After type change, new textarea should be empty
    const textArea = screen.getByRole("textbox");
    expect(textArea).toHaveValue("");
  });

  it("should show pending state", () => {
    useExperimentAnnotationAddBulkMock.mockReturnValue({
      mutateAsync: mockAddAnnotationsBulk,
      isPending: true,
    });

    render(<AddAnnotationDialog {...mockProps} />);

    const submitButton = screen.getByText(
      'experimentDataAnnotations.commentDialogBulk.addPending:{"count":3}',
    );
    expect(submitButton).toBeDisabled();
  });

  it("should not render when open is false", () => {
    render(<AddAnnotationDialog {...mockProps} open={false} />);

    expect(
      screen.queryByText("experimentDataAnnotations.commentDialogBulk.title"),
    ).not.toBeInTheDocument();
  });

  it("should work without optional props", () => {
    const minimalProps = {
      experimentId: "exp-123",
      tableName: "test-table",
      rowIds: ["1"],
      type: "comment" as AnnotationType,
    };

    expect(() => render(<AddAnnotationDialog {...minimalProps} />)).not.toThrow();
  });

  it("should show both flag type options", () => {
    render(<AddAnnotationDialog {...mockProps} type="flag" />);

    // Check that both flag type options are available
    expect(screen.getByText("experimentDataAnnotations.flagTypes.outlier")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.flagTypes.needsReview")).toBeInTheDocument();
  });

  it("should have correct textarea rows for different types", () => {
    const { rerender } = render(<AddAnnotationDialog {...mockProps} type="comment" />);
    let textArea = screen.getByRole("textbox");
    expect(textArea).toHaveAttribute("rows", "4");

    rerender(<AddAnnotationDialog {...mockProps} type="flag" />);
    textArea = screen.getByRole("textbox");
    expect(textArea).toHaveAttribute("rows", "3");
  });
});
