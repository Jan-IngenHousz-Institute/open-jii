import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import type { AnnotationType } from "@repo/api";

import { DeleteAnnotationsDialog } from "./delete-annotations-dialog";

const mockProps = {
  experimentId: "exp-123",
  tableName: "test-table",
  rowIds: ["1", "2", "3"],
  type: "comment" as AnnotationType,
  open: true,
  setOpen: vi.fn(),
  clearSelection: vi.fn(),
};

function mountDeleteEndpoint(options = {}) {
  return server.mount(contract.experiments.deleteAnnotationsBulk, {
    body: { rowsAffected: 3 },
    status: 204,
    ...options,
  });
}

describe("DeleteAnnotationsDialog", () => {
  it("should render dialog when open", () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    expect(
      screen.getByText("experimentDataAnnotations.commentDeleteDialog.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.commentDeleteDialog.description"),
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

  it("should show description text", () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    expect(
      screen.getByText(/experimentDataAnnotations.commentDeleteDialog.description/),
    ).toBeInTheDocument();
  });

  it("should call setOpen when cancel is clicked", async () => {
    render(<DeleteAnnotationsDialog {...mockProps} />);

    const user = userEvent.setup();
    const cancelButton = screen.getByText(/common.cancel/);
    await user.click(cancelButton);

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  it("should send correct request when delete is clicked", async () => {
    const spy = mountDeleteEndpoint();

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const user = userEvent.setup();
    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    await user.click(deleteButton);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-123" });
    expect(spy.body).toMatchObject({
      tableName: "test-table",
      rowIds: ["1", "2", "3"],
      type: "comment",
    });
  });

  it("should call clearSelection and setOpen after successful delete", async () => {
    mountDeleteEndpoint();

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const user = userEvent.setup();
    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockProps.clearSelection).toHaveBeenCalled();
      expect(mockProps.setOpen).toHaveBeenCalledWith(false);
    });
  });

  it("should show pending state while request is in flight", async () => {
    mountDeleteEndpoint({ delay: 500 });

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const user = userEvent.setup();
    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(
        screen.getByText("experimentDataAnnotations.commentDeleteDialog.deletePending"),
      ).toBeDisabled();
    });
  });

  it("should show toast on successful delete", async () => {
    const { toast } = await import("@repo/ui/hooks");
    mountDeleteEndpoint();

    render(<DeleteAnnotationsDialog {...mockProps} />);

    const user = userEvent.setup();
    const deleteButton = screen.getByText("experimentDataAnnotations.commentDeleteDialog.delete");
    await user.click(deleteButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.deleted.comments",
      });
    });
  });
});
