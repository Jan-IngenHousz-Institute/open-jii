import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { AnnotationType } from "@repo/api";

import { AddAnnotationDialog } from "./add-annotation-dialog";

const defaultProps = {
  experimentId: "exp-123",
  tableName: "test-table",
  rowIds: ["1", "2", "3"],
  type: "comment" as AnnotationType,
  open: true,
  setOpen: vi.fn(),
  clearSelection: vi.fn(),
};

function mountAddSingle(options = {}) {
  return server.mount(contract.experiments.addAnnotation, {
    body: { rowsAffected: 1 },
    status: 201,
    ...options,
  });
}

function mountAddBulk(options = {}) {
  return server.mount(contract.experiments.addAnnotationsBulk, {
    body: { rowsAffected: 3 },
    status: 201,
    ...options,
  });
}

describe("AddAnnotationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bulk comment dialog title and description", () => {
    render(<AddAnnotationDialog {...defaultProps} />);

    expect(
      screen.getByText("experimentDataAnnotations.commentDialogBulk.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.commentDialogBulk.description"),
    ).toBeInTheDocument();
  });

  it("renders single comment dialog title for one row", () => {
    render(<AddAnnotationDialog {...defaultProps} rowIds={["1"]} />);

    expect(screen.getByText("experimentDataAnnotations.commentDialog.title")).toBeInTheDocument();
  });

  it("renders flag dialog title for flag type", () => {
    render(<AddAnnotationDialog {...defaultProps} type="flag" />);

    expect(screen.getByText("experimentDataAnnotations.flagDialogBulk.title")).toBeInTheDocument();
  });

  it("shows flag type selector only for flag annotations", () => {
    const { rerender } = render(<AddAnnotationDialog {...defaultProps} type="flag" />);
    expect(screen.getByText("experimentDataAnnotations.flagType")).toBeInTheDocument();

    rerender(<AddAnnotationDialog {...defaultProps} type="comment" />);
    expect(screen.queryByText("experimentDataAnnotations.flagType")).not.toBeInTheDocument();
  });

  it("sends single annotation request for one row", async () => {
    const spy = mountAddSingle();
    const user = userEvent.setup();

    render(<AddAnnotationDialog {...defaultProps} rowIds={["1"]} />);

    await user.type(screen.getByRole("textbox"), "Test comment");
    await user.click(
      screen.getByRole("button", { name: "experimentDataAnnotations.commentDialog.add" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "exp-123" });
    expect(spy.body).toMatchObject({
      tableName: "test-table",
      rowId: "1",
      annotation: {
        type: "comment",
        content: { type: "comment", text: "Test comment" },
      },
    });
  });

  it("sends bulk annotation request for multiple rows", async () => {
    const spy = mountAddBulk();
    const user = userEvent.setup();

    render(<AddAnnotationDialog {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "Bulk comment");
    await user.click(
      screen.getByRole("button", { name: "experimentDataAnnotations.commentDialogBulk.add" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      tableName: "test-table",
      rowIds: ["1", "2", "3"],
      annotation: {
        type: "comment",
        content: { type: "comment", text: "Bulk comment" },
      },
    });
  });

  it("closes dialog and shows toast after successful submission", async () => {
    mountAddBulk();
    const user = userEvent.setup();

    render(<AddAnnotationDialog {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "test");
    await user.click(
      screen.getByRole("button", { name: "experimentDataAnnotations.commentDialogBulk.add" }),
    );

    const { toast } = await import("@repo/ui/hooks");
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ description: "experimentDataAnnotations.updated" });
      expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
      expect(defaultProps.clearSelection).toHaveBeenCalled();
    });
  });

  it("disables submit button while request is in flight", async () => {
    mountAddBulk({ delay: 999_999 });
    const user = userEvent.setup();

    render(<AddAnnotationDialog {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "test");
    await user.click(
      screen.getByRole("button", { name: "experimentDataAnnotations.commentDialogBulk.add" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /addPending/ })).toBeDisabled();
    });
  });

  it("does not render content when closed", () => {
    render(<AddAnnotationDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByText("experimentDataAnnotations.commentDialogBulk.title"),
    ).not.toBeInTheDocument();
  });

  it("uses different textarea rows for comments vs flags", () => {
    const { rerender } = render(<AddAnnotationDialog {...defaultProps} type="comment" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "4");

    rerender(<AddAnnotationDialog {...defaultProps} type="flag" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "3");
  });

  it("renders without crashing with minimal props", () => {
    expect(() =>
      render(
        <AddAnnotationDialog
          experimentId="exp-123"
          tableName="test-table"
          rowIds={["1"]}
          type="comment"
        />,
      ),
    ).not.toThrow();
  });
});
