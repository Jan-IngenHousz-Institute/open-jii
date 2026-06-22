import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { TablePaginationFooter } from "./table-pagination-footer";

describe("TablePaginationFooter", () => {
  it("renders the localized page-of label with current and total page", () => {
    render(
      <TablePaginationFooter page={2} totalPages={5} onPageChange={vi.fn()} isLoading={false} />,
    );
    expect(screen.getByText("widget.tablePageOf")).toBeInTheDocument();
  });

  it("advances to the next page when Next is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TablePaginationFooter
        page={2}
        totalPages={5}
        onPageChange={onPageChange}
        isLoading={false}
      />,
    );
    await user.click(screen.getByLabelText("Go to next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("goes back one page when Previous is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TablePaginationFooter
        page={3}
        totalPages={5}
        onPageChange={onPageChange}
        isLoading={false}
      />,
    );
    await user.click(screen.getByLabelText("Go to previous page"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("clamps Previous at page 1 instead of going below", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TablePaginationFooter
        page={1}
        totalPages={5}
        onPageChange={onPageChange}
        isLoading={false}
      />,
    );
    await user.click(screen.getByLabelText("Go to previous page"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks Previous as aria-disabled on page 1 and Next on the last page", () => {
    const { rerender } = render(
      <TablePaginationFooter page={1} totalPages={3} onPageChange={vi.fn()} isLoading={false} />,
    );
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "true");

    rerender(
      <TablePaginationFooter page={3} totalPages={3} onPageChange={vi.fn()} isLoading={false} />,
    );
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders a skeleton footer instead of pagination controls while loading", () => {
    render(
      <TablePaginationFooter page={1} totalPages={1} onPageChange={vi.fn()} isLoading={true} />,
    );
    expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Go to previous page")).not.toBeInTheDocument();
  });
});
