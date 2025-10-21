import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddAnnotationDialogFormType } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";

// Hoisted mocks
const mockMutateAddAnnotation = vi.hoisted(() => vi.fn());
const mockMutateAddAnnotationsBulk = vi.hoisted(() => vi.fn());
const { mockToast } = vi.hoisted(() => {
  const mockToast = vi.fn();

  return { mockToast };
});

// Mock hooks
vi.mock("~/hooks/experiment/useExperimentAddAnnotation/useExperimentAddAnnotation", () => ({
  useExperimentAddAnnotation: () => ({
    mutateAsync: mockMutateAddAnnotation,
  }),
}));
vi.mock(
  "~/hooks/experiment/useExperimentAddAnnotationsBulk/useExperimentAddAnnotationsBulk",
  () => ({
    useExperimentAddAnnotationsBulk: () => ({
      mutateAsync: mockMutateAddAnnotationsBulk,
    }),
  }),
);

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
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

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent(
      "experimentDataAnnotations.commentDialog.title",
    );
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "experimentDataAnnotations.commentDialog.description",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(1);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("common.cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent(
      "experimentDataAnnotations.commentDialog.add",
    );
  });

  it("should render dialog for adding a flag", () => {
    render(
      <AddAnnotationDialog experimentId="exp1" tableName="table1" rowIds={["row1"]} type="flag" />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent(
      "experimentDataAnnotations.flagDialog.title",
    );
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "experimentDataAnnotations.flagDialog.description",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(2);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("common.cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent(
      "experimentDataAnnotations.flagDialog.add",
    );
  });

  it("should render dialog for adding bulk comments", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="comment"
        bulk={true}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent(
      "experimentDataAnnotations.commentDialogBulk.title",
    );
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "experimentDataAnnotations.commentDialogBulk.description",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(1);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("common.cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent(
      "experimentDataAnnotations.commentDialogBulk.add",
    );
  });

  it("should render dialog for adding bulk flags", () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="flag"
        bulk={true}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent(
      "experimentDataAnnotations.flagDialogBulk.title",
    );
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "experimentDataAnnotations.flagDialogBulk.description",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(2);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("common.cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent(
      "experimentDataAnnotations.flagDialogBulk.add",
    );
  });

  it("should handle form submission for add a single comment", async () => {
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

    await vi.waitFor(() => {
      expect(mockMutateAddAnnotation).toHaveBeenCalledWith({
        params: { id: "exp1" },
        body: {
          tableName: "table1",
          rowId: "row1",
          annotation: {
            type: "comment",
            content: {
              text: "Test Comment",
            },
          },
        },
      });

      expect(mockToast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.updated",
      });
    });
  });

  it("should handle form submission for add bulk comments", async () => {
    render(
      <AddAnnotationDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2"]}
        type="comment"
        bulk={true}
      />,
      { wrapper: createWrapper() },
    );

    const form = screen.getByTestId("form").querySelector("form");
    if (form) fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(mockMutateAddAnnotationsBulk).toHaveBeenCalledWith({
        params: { id: "exp1" },
        body: {
          tableName: "table1",
          rowIds: ["row1", "row2"],
          annotation: {
            type: "comment",
            content: {
              text: "Test Comment",
            },
          },
        },
      });

      expect(mockToast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.updated",
      });
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
