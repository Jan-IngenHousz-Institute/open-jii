import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AddCommentDialog } from "~/components/experiment-data/comments/add-comment-dialog";

// Mock hooks
const useExperimentDataCommentsCreateMock = vi.hoisted(() => vi.fn());
vi.mock(
  "~/hooks/experiment/useExperimentDataCommentsCreate/useExperimentDataCommentsCreate",
  () => ({
    useExperimentDataCommentsCreate: () => useExperimentDataCommentsCreateMock,
  }),
);

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.cancel": "Cancel",
        "experimentDataComments.updated": "Comments and flags updated",
        "experimentDataComments.commentDialog.title": "Add Comment",
        "experimentDataComments.commentDialog.description": "Add a comment to the measurement",
        "experimentDataComments.commentDialog.textLabel": "Comment",
        "experimentDataComments.commentDialog.textPlaceholder": "Enter your comment here...",
        "experimentDataComments.commentDialog.add": "Add Comment",
        "experimentDataComments.commentDialog.cancel": "Cancel",
        "experimentDataComments.commentDialogBulk.title": "Bulk Add Comment",
        "experimentDataComments.commentDialogBulk.description":
          "Add the same comment to 3 selected measurements",
        "experimentDataComments.commentDialogBulk.textLabel": "Comment",
        "experimentDataComments.commentDialogBulk.textPlaceholder": "Enter your comment here...",
        "experimentDataComments.commentDialogBulk.add": "Add to 3 Row(s)",
        "experimentDataComments.commentDialogBulk.cancel": "Cancel",
        "experimentDataComments.flagDialog.title": "Add Flag",
        "experimentDataComments.flagDialog.description": "Flag the measurement",
        "experimentDataComments.flagDialog.flagLabel": "Flag Type",
        "experimentDataComments.flagDialog.flagPlaceholder": "Select flag type",
        "experimentDataComments.flagDialog.textLabel": "Reason",
        "experimentDataComments.flagDialog.textPlaceholder":
          "Explain why this measurement is being flagged...",
        "experimentDataComments.flagDialog.add": "Add Flag",
        "experimentDataComments.flagDialog.cancel": "Cancel",
        "experimentDataComments.flagDialogBulk.title": "Bulk Add Flag",
        "experimentDataComments.flagDialogBulk.description": "Flag 3 selected measurements",
        "experimentDataComments.flagDialogBulk.flagLabel": "Flag Type",
        "experimentDataComments.flagDialogBulk.flagPlaceholder": "Select flag type",
        "experimentDataComments.flagDialogBulk.textLabel": "Reason",
        "experimentDataComments.flagDialogBulk.textPlaceholder":
          "Explain why these measurements are being flagged..",
        "experimentDataComments.flagDialogBulk.add": "Flag 3 Row(s)",
        "experimentDataComments.flagDialogBulk.cancel": "Cancel",
        "experimentDataComments.flagType.needs_review": "Needs Review",
        "experimentDataComments.flagType.outlier": "Outlier",
      };
      return translations[key] || key;
    },
  }),
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
      <AddCommentDialog experimentId="exp1" tableName="table1" rowIds={["row1"]} type="comment" />,
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
      <AddCommentDialog experimentId="exp1" tableName="table1" rowIds={["row1"]} type="flag" />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Add Flag");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent("Flag the measurement");
    expect(screen.queryAllByTestId("form-field")).toHaveLength(2);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Add Flag");
  });

  it("should render dialog for adding bulk comments", () => {
    render(
      <AddCommentDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="comment"
        bulk={true}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Bulk Add Comment");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "Add the same comment to 3 selected measurements",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(1);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Add to 3 Row(s)");
  });

  it("should render dialog for adding bulk flags", () => {
    render(
      <AddCommentDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="flag"
        bulk={true}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Bulk Add Flag");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "Flag 3 selected measurements",
    );
    expect(screen.queryAllByTestId("form-field")).toHaveLength(2);
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Flag 3 Row(s)");
  });
});
