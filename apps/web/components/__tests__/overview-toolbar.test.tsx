import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OverviewToolbar } from "../overview-toolbar";

describe("OverviewToolbar", () => {
  it("scrolls the filter strip on a phone rather than wrapping it", () => {
    render(
      <OverviewToolbar
        search={<input aria-label="Search" />}
        filters={
          <>
            <button>All</button>
            <button>Active</button>
            <button>Pending</button>
            <button>Revoked</button>
          </>
        }
      />,
    );

    // Four chips wrapped to a second row and pushed the table down.
    const strip = screen.getByText("All").parentElement;
    expect(strip).toHaveClass("overflow-x-auto", "[&>*]:shrink-0");
    expect(strip).toHaveClass("md:flex-wrap", "md:overflow-visible");
    expect(strip).not.toHaveClass("flex-wrap");
  });

  it("renders no filter strip when a listing has no filters", () => {
    render(<OverviewToolbar search={<input aria-label="Search" />} />);

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
