import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { AnnotationType } from "@repo/api";

import { DeleteAnnotationsDialog } from "./delete-annotations-dialog";

// Hoisted mocks
const mockDeleteAnnotationsBulk = vi.hoisted(() => vi.fn());
const useExperimentDeleteAnnotationsBulkMock = vi.hoisted(() => vi.fn());

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

// Mock the hook
vi.mock(
  "~/hooks/experiment/annotations/useExperimentAnnotationDeleteBulk/useExperimentAnnotationDeleteBulk",
  () => ({
    useExperimentAnnotationDeleteBulk: useExperimentDeleteAnnotationsBulkMock,
  }),
);

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
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

describe("DeleteAnnotationsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExperimentDeleteAnnotationsBulkMock.mockReturnValue({
      mutateAsync: mockDeleteAnnotationsBulk,
      isPending: false,
    });
  });

  it("should render dialog when open", () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    expect(
      screen.getByText("experimentDataAnnotations.commentDeleteDialog.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText('experimentDataAnnotations.commentDeleteDialog.description:{"count":3}'),
    ).toBeInTheDocument();
  });

  it("should not render dialog when closed", () => {
    render(<DeleteAnnotationsDialog {...mockProps} open={false} />);

    expect(
      screen.queryByText(/experimentDataAnnotations.comment.DeleteDialog.title/),
    ).not.toBeInTheDocument();
  });

  it("should render correct content for flag type", () => {
    render(<DeleteAnnotationsDialog {...mockProps} type="flag" />);

    expect(
      screen.getByText("experimentDataAnnotations.flagDeleteDialog.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/experimentDataAnnotations.flagDeleteDialog.description/),
    ).toBeInTheDocument();
  });

  it("should show count in description", () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    const description = screen.getByText(
      /experimentDataAnnotations.commentDeleteDialog.description/,
    );
    expect(description.textContent).toContain('{"count":3}');
  });

  it("should call setOpen when cancel is clicked", () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    const cancelButton = screen.getByText(/common.cancel/);
    fireEvent.click(cancelButton);

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should call deleteAnnotationsBulk when delete is clicked", async () => {
    mockDeleteAnnotationsBulk.mockResolvedValue({});

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteAnnotationsBulk).toHaveBeenCalledWith({
        params: { id: "exp-123" },
        body: {
          tableName: "test-table",
          rowIds: ["1", "2", "3"],
          type: "comment",
        },
      });
    });
  });

  it("should call clearSelection and setOpen after successful delete", async () => {
    mockDeleteAnnotationsBulk.mockResolvedValue({});

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockProps.clearSelection).toHaveBeenCalled();
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
    });
  });

  it("should handle pending state", () => {
    useExperimentDeleteAnnotationsBulkMock.mockReturnValue({
      mutateAsync: mockDeleteAnnotationsBulk,
      isPending: true,
    });

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const deleteButton = screen.getByText(
      "experimentDataAnnotations.commentDeleteDialog.deletePending",
    );
    expect(deleteButton).toBeDisabled();
  });

  it("should show toast on successful delete", async () => {
    const { toast } = await import("@repo/ui/hooks");
    mockDeleteAnnotationsBulk.mockResolvedValue({});

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.deleted.comments",
      });
    });
  });
});
