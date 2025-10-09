import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddAnnotationDialogFormType } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";

// Hoisted mocks
const { mockToast } = vi.hoisted(() => {
  const mockToast = vi.fn();

  return { mockToast };
});

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.cancel": "Cancel",
        "experimentDataAnnotations.updated": "Comments and flags updated",
        "experimentDataAnnotations.commentDialog.title": "Add Comment",
        "experimentDataAnnotations.commentDialog.description": "Add a comment to the measurement",
        "experimentDataAnnotations.commentDialog.textLabel": "Comment",
        "experimentDataAnnotations.commentDialog.textPlaceholder": "Enter your comment here...",
        "experimentDataAnnotations.commentDialog.add": "Add Comment",
        "experimentDataAnnotations.commentDialog.cancel": "Cancel",
        "experimentDataAnnotations.commentDialogBulk.title": "Bulk Add Comment",
        "experimentDataAnnotations.commentDialogBulk.description":
          "Add the same comment to 3 selected measurements",
        "experimentDataAnnotations.commentDialogBulk.textLabel": "Comment",
        "experimentDataAnnotations.commentDialogBulk.textPlaceholder": "Enter your comment here...",
        "experimentDataAnnotations.commentDialogBulk.add": "Add to 3 Row(s)",
        "experimentDataAnnotations.commentDialogBulk.cancel": "Cancel",
        "experimentDataAnnotations.flagDialog.title": "Add Flag",
        "experimentDataAnnotations.flagDialog.description": "Flag the measurement",
        "experimentDataAnnotations.flagDialog.flagLabel": "Flag Type",
        "experimentDataAnnotations.flagDialog.flagPlaceholder": "Select flag type",
        "experimentDataAnnotations.flagDialog.textLabel": "Reason",
        "experimentDataAnnotations.flagDialog.textPlaceholder":
          "Explain why this measurement is being flagged...",
        "experimentDataAnnotations.flagDialog.add": "Add Flag",
        "experimentDataAnnotations.flagDialog.cancel": "Cancel",
        "experimentDataAnnotations.flagDialogBulk.title": "Bulk Add Flag",
        "experimentDataAnnotations.flagDialogBulk.description": "Flag 3 selected measurements",
        "experimentDataAnnotations.flagDialogBulk.flagLabel": "Flag Type",
        "experimentDataAnnotations.flagDialogBulk.flagPlaceholder": "Select flag type",
        "experimentDataAnnotations.flagDialogBulk.textLabel": "Reason",
        "experimentDataAnnotations.flagDialogBulk.textPlaceholder":
          "Explain why these measurements are being flagged..",
        "experimentDataAnnotations.flagDialogBulk.add": "Flag 3 Row(s)",
        "experimentDataAnnotations.flagDialogBulk.cancel": "Cancel",
        "experimentDataAnnotations.flagType.needs_review": "Needs Review",
        "experimentDataAnnotations.flagType.outlier": "Outlier",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  MessageSquare: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="message-square-icon" {...props}>
      <rect width="100%" height="100%" fill="currentColor" />
    </svg>
  ),
  Flag: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="flag-icon" {...props}>
      <rect width="100%" height="100%" fill="currentColor" />
    </svg>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    className,
    type,
    children,
  }: {
    className?: string;
    type?: string;
    children?: React.ReactNode;
  }) => (
    <div data-testid={`button${type ? "-" + type : ""}`} className={className}>
      {children ?? "Button"}
    </div>
  ),
  Dialog: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog">{children ?? "Dialog"}</div>
  ),
  DialogClose: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-close">{children ?? "DialogClose"}</div>
  ),
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children ?? "DialogContent"}</div>
  ),
  DialogDescription: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-description">{children ?? "DialogDescription"}</div>
  ),
  DialogFooter: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children ?? "DialogFooter"}</div>
  ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children ?? "DialogHeader"}</div>
  ),
  DialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-title">{children ?? "DialogTitle"}</div>
  ),
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-trigger">{children ?? "DialogTrigger"}</div>
  ),
  Form: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form">{children ?? "Form"}</div>
  ),
  FormControl: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form-control">{children ?? "FormControl"}</div>
  ),
  FormField: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form-field">{children ?? "FormField"}</div>
  ),
  FormItem: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form-item">{children ?? "FormItem"}</div>
  ),
  FormLabel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form-label">{children ?? "FormLabel"}</div>
  ),
  FormMessage: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="form-message">{children ?? "FormMessage"}</div>
  ),
  Select: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select">{children ?? "Select"}</div>
  ),
  SelectContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select-content">{children ?? "SelectContent"}</div>
  ),
  SelectGroup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select-group">{children ?? "SelectGroup"}</div>
  ),
  SelectItem: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select-item">{children ?? "SelectItem"}</div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select-trigger">{children ?? "SelectTrigger"}</div>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select-value">{children ?? "SelectValue"}</div>
  ),
  Textarea: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="textarea">{children ?? "Textarea"}</div>
  ),
}));

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    handleSubmit: (fn: (data: AddAnnotationDialogFormType) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      // Simulate form submission with mock data
      const mockFormData: AddAnnotationDialogFormType = {
        text: "Test Comment",
      };
      fn(mockFormData);
    },
    formState: { errors: {} },
    control: {},
    register: () => ({}),
    setValue: vi.fn(),
    getValues: () => ({}),
    watch: () => ({}),
  }),
}));

describe("AddCommentDialog", () => {
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => children;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Add event listener mocks
    vi.spyOn(window, "addEventListener").mockImplementation(() => {
      // Mock implementation
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {
      // Mock implementation
    });
  });

  it("should render dialog for adding a comment", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        type="comment"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Add Comment");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "Add a comment to the measurement",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(1);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Add Comment");
  });

  it("should render dialog for adding a flag", () => {
    render(
      <AddAnnotationDialog experimentId="exp1" tableName="table1" rowIds={["row1"]} type="flag" />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Add Flag");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent("Flag the measurement");
    expect(screen.queryAllByTestId("form-field")).toHaveLength(2);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Add Flag");
  });

  it("should handle form submission for comment", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        type="comment"
      />,
      { wrapper: createWrapper() },
    );

    const form = screen.getByTestId("form").querySelector("form");
    if (form) fireEvent.submit(form);

    expect(mockToast).toHaveBeenCalledWith({
      description: "Comments and flags updated",
    });
  });

  it("should handle form submission for flag", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2"]}
        type="flag"
      />,
      { wrapper: createWrapper() },
    );

    const form = screen.getByTestId("form").querySelector("form");
    if (form) fireEvent.submit(form);

    expect(mockToast).toHaveBeenCalledWith({
      description: "Comments and flags updated",
    });
  });

  it("should render MessageSquare icon for comment type", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        type="comment"
      />,
      { wrapper: createWrapper() },
    );

    // The MessageSquare component should be rendered
    expect(screen.getByTestId("message-square-icon")).toBeInTheDocument();
  });

  it("should render Flag icon for flag type", () => {
    render(
      <AddAnnotationDialog experimentId="exp1" tableName="table1" rowIds={["row1"]} type="flag" />,
      { wrapper: createWrapper() },
    );

    // The Flag component should be rendered
    expect(screen.getByTestId("flag-icon")).toBeInTheDocument();
  });
});
