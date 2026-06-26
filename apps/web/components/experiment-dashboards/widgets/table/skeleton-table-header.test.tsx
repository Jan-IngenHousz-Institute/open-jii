import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { SkeletonTableHeader } from "./skeleton-table-header";

describe("SkeletonTableHeader", () => {
  it("renders one skeleton cell per requested column", () => {
    const { container } = render(
      <table>
        <SkeletonTableHeader columnCount={5} />
      </table>,
    );
    expect(container.querySelectorAll("th")).toHaveLength(5);
  });

  it("renders zero cells when columnCount is zero", () => {
    const { container } = render(
      <table>
        <SkeletonTableHeader columnCount={0} />
      </table>,
    );
    expect(container.querySelectorAll("th")).toHaveLength(0);
  });
});
