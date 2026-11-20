import { renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useLandedRowIds } from "./useLandedRowIds";

const READ_AT = "2026-11-19T09:00:00.000Z";
const NEXT_READ_AT = "2026-11-19T09:00:30.000Z";

const PAGE = [
  { id: "a", processed_timestamp: "2026-11-19T08:59:00.000Z" },
  { id: "b", processed_timestamp: READ_AT },
];
const ARRIVED = { id: "c", processed_timestamp: NEXT_READ_AT };
const MOVED_IN = { id: "z", processed_timestamp: "2026-11-19T08:00:00.000Z" };

interface Props {
  rows: { id: string; processed_timestamp: string }[] | undefined;
  view: string;
  latestRowAt: string | null;
}

function renderLanded(initialProps: Props) {
  return renderHook(
    ({ rows, view, latestRowAt }: Props) => useLandedRowIds(rows, view, latestRowAt),
    { initialProps },
  );
}

describe("useLandedRowIds", () => {
  it("lands nothing on the first load", () => {
    const { result } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: READ_AT });

    expect(result.current.size).toBe(0);
  });

  it("lands the rows processed since the previous read", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: READ_AT });

    rerender({ rows: PAGE, view: "page-1", latestRowAt: NEXT_READ_AT });
    rerender({ rows: [ARRIVED, ...PAGE], view: "page-1", latestRowAt: NEXT_READ_AT });

    expect([...result.current]).toEqual(["c"]);
  });

  it("lands nothing for an older row that only moved into the view", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-2", latestRowAt: READ_AT });

    rerender({ rows: [MOVED_IN, ...PAGE], view: "page-2", latestRowAt: NEXT_READ_AT });

    expect(result.current.size).toBe(0);
  });

  it("lands nothing for a table with no newest-row time", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: null });

    rerender({ rows: [ARRIVED, ...PAGE], view: "page-1", latestRowAt: null });

    expect(result.current.size).toBe(0);
  });

  it("keeps them landed across renders that change nothing", () => {
    const refetched = [ARRIVED, ...PAGE];
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: READ_AT });

    rerender({ rows: refetched, view: "page-1", latestRowAt: NEXT_READ_AT });
    rerender({ rows: refetched, view: "page-1", latestRowAt: NEXT_READ_AT });

    expect([...result.current]).toEqual(["c"]);
  });

  it("lands nothing when the page, sort or filters change", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: READ_AT });

    rerender({ rows: [ARRIVED], view: "page-2", latestRowAt: NEXT_READ_AT });

    expect(result.current.size).toBe(0);
  });

  it("lands nothing when a new view loads after an empty moment", () => {
    const { result, rerender } = renderLanded({ rows: PAGE, view: "page-1", latestRowAt: READ_AT });

    rerender({ rows: undefined, view: "page-2", latestRowAt: READ_AT });
    rerender({ rows: [ARRIVED], view: "page-2", latestRowAt: NEXT_READ_AT });

    expect(result.current.size).toBe(0);
  });
});
