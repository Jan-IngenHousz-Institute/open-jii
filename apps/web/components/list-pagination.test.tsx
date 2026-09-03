import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ListPagination } from "./list-pagination";

describe("ListPagination", () => {
  it("keeps one-page overview pagination visible with both directions disabled", () => {
    render(<ListPagination page={1} totalPages={1} onPageChange={vi.fn()} />);

    expect(screen.getByText("pagination.pageOf")).toBeVisible();
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });
});
