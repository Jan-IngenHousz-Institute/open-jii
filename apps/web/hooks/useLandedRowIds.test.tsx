import { renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useLandedRowIds } from "./useLandedRowIds";

const PAGE = [{ id: "a" }, { id: "b" }];

interface Props {
  rows: { id: string }[] | undefined;
  view: string;
}

function renderLanded(initialProps: Props) {
  return renderHook(({ rows, view }: Props) => useLandedRowIds(rows, view), { initialProps });
}

describe("useLandedRowIds", () => {
  it("lands nothing on the first load", () => {
    const { result } = renderLanded({ rows: PAGE, view: "page-1" });

    expect(result.current.size).toBe(0);
  });

  it("lands the rows a refetch of the same view adds", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1" });

    rerender({ rows: [{ id: "c" }, ...PAGE], view: "page-1" });

    expect([...result.current]).toEqual(["c"]);
  });

  it("keeps them landed across renders that change nothing", () => {
    const refetched = [{ id: "c" }, ...PAGE];
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1" });

    rerender({ rows: refetched, view: "page-1" });
    rerender({ rows: refetched, view: "page-1" });

    expect([...result.current]).toEqual(["c"]);
  });

  it("lands nothing when the page, sort or filters change", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1" });

    rerender({ rows: [{ id: "c" }, { id: "d" }], view: "page-2" });

    expect(result.current.size).toBe(0);
  });

  it("lands nothing when a new view loads after an empty moment", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1" });

    rerender({ rows: undefined, view: "page-2" });
    rerender({ rows: [{ id: "c" }], view: "page-2" });

    expect(result.current.size).toBe(0);
  });
});
