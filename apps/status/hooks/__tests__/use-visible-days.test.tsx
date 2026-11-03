import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { stubViewport } from "~/test/stub-viewport";

import { useVisibleDays } from "../use-visible-days";

describe("useVisibleDays", () => {
  it("shows the full 90 days on a viewport from Tailwind's sm up", () => {
    stubViewport(false);

    expect(renderHook(() => useVisibleDays()).result.current).toBe(90);
  });

  it("shows the last 30 days below it", () => {
    stubViewport(true);

    expect(renderHook(() => useVisibleDays()).result.current).toBe(30);
  });

  it("follows the viewport as it crosses the breakpoint", () => {
    const viewport = stubViewport(false);
    const { result } = renderHook(() => useVisibleDays());

    viewport.resizeTo("narrow");
    expect(result.current).toBe(30);

    viewport.resizeTo("wide");
    expect(result.current).toBe(90);
  });

  it("stops listening when it unmounts", () => {
    const viewport = stubViewport(false);
    const { result, unmount } = renderHook(() => useVisibleDays());

    unmount();
    viewport.resizeTo("narrow");

    expect(result.current).toBe(90);
  });
});
