import { render, renderHook } from "@testing-library/react";
import React, { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJoinCodeEntrySheet } from "./use-join-code-entry-sheet";

const present = vi.hoisted(() => vi.fn<() => void>());

vi.mock("~/features/experiments/components/join-code-entry-sheet", () => ({
  JoinCodeEntrySheet: forwardRef<{ present: () => void }>(function JoinCodeEntrySheet(_props, ref) {
    useImperativeHandle(ref, () => ({ present }));
    return <div data-testid="entry-sheet" />;
  }),
}));

beforeEach(() => {
  present.mockClear();
});

describe("useJoinCodeEntrySheet", () => {
  it("hands back the sheet to render, so the component itself stays private", () => {
    const { result } = renderHook(() => useJoinCodeEntrySheet());

    const { container } = render(<>{result.current.sheet}</>);

    expect(container.querySelector("[data-testid='entry-sheet']")).toBeTruthy();
  });

  it("presents the sheet once it is mounted", () => {
    const { result } = renderHook(() => useJoinCodeEntrySheet());
    render(<>{result.current.sheet}</>);

    result.current.open();

    expect(present).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the sheet is not mounted, rather than throwing", () => {
    const { result } = renderHook(() => useJoinCodeEntrySheet());

    expect(() => result.current.open()).not.toThrow();
    expect(present).not.toHaveBeenCalled();
  });
});
