import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { toast } from "@repo/ui/hooks/use-toast";

import { RowActionsMenu } from "./row-actions-menu";

const labels = {
  trigger: "More actions",
  edit: "Edit",
  delete: "Delete",
  deleteDescription: "Delete it?",
  cancel: "Cancel",
  deleted: "Deleted",
};

async function confirmDelete() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: /Delete/u }));
  expect(await screen.findByText("Delete it?")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Delete" }));
}

describe("RowActionsMenu", () => {
  it("links Edit to the given page", async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu editHref="/edit/1" labels={labels} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: /Edit/u })).toHaveAttribute(
      "href",
      "/edit/1",
    );
  });

  it("deletes only after the confirm, then toasts and closes the dialog", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RowActionsMenu editHref="/edit/1" labels={labels} onDelete={onDelete} />);

    await confirmDelete();

    expect(onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Delete it?")).toBeNull());
    expect(toast).toHaveBeenCalledWith({ title: "Deleted" });
  });

  it("keeps the dialog open without a toast when the delete fails", async () => {
    vi.mocked(toast).mockClear();
    const onDelete = vi.fn().mockRejectedValue(new Error("refused"));
    render(<RowActionsMenu editHref="/edit/1" labels={labels} onDelete={onDelete} />);

    await confirmDelete();

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled());
    expect(screen.getByText("Delete it?")).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });
});
