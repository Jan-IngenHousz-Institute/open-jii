import { act, renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { StrictMode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ListDepartureProvider,
  useDepartureNavigation,
  useDepartureRouter,
  useListDeparture,
} from "./list-departure";

function useRegisteredNavigation(
  flush: () => void,
  onNavigate?: (event: { preventDefault: () => void }) => void,
) {
  const departure = useListDeparture();
  useEffect(() => departure?.register(flush), [departure, flush]);
  return { departure, navigate: useDepartureNavigation(onNavigate), router: useDepartureRouter() };
}

describe("list departure boundary", () => {
  it("calls the caller before flushing, and honors cancellation", () => {
    const order: string[] = [];
    const flush = () => {
      order.push("flush");
    };
    const onNavigate = vi.fn(() => {
      order.push("caller");
    });
    const { result, rerender } = renderHook(
      ({ cancel }) =>
        useRegisteredNavigation(flush, (event) => {
          onNavigate();
          if (cancel) event.preventDefault();
        }),
      { wrapper: ListDepartureProvider, initialProps: { cancel: false } },
    );
    const preventDefault = vi.fn();
    act(() => result.current.navigate({ preventDefault }));
    expect(order).toEqual(["caller", "flush"]);
    expect(preventDefault).not.toHaveBeenCalled();
    rerender({ cancel: true });
    order.length = 0;
    act(() => result.current.navigate({ preventDefault }));
    expect(order).toEqual(["caller"]);
    expect(preventDefault).toHaveBeenCalledOnce();
    rerender({ cancel: false });
    act(() => result.current.navigate({ preventDefault }));
    expect(order).toEqual(["caller", "caller", "flush"]);
  });

  it("unregisters old callbacks and cleans up without flushing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ flush }) => useRegisteredNavigation(flush),
      {
        wrapper: ListDepartureProvider,
        initialProps: { flush: first },
      },
    );
    const departure = result.current.departure;
    rerender({ flush: second });
    act(() => departure?.flush());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unmount();
    act(() => departure?.flush());
    expect(second).toHaveBeenCalledOnce();
  });

  it("keeps one registration during Strict Mode's cleanup and remount", () => {
    const flush = vi.fn();
    const { result } = renderHook(() => useRegisteredNavigation(flush), {
      wrapper: ({ children }) => (
        <StrictMode>
          <ListDepartureProvider>{children}</ListDepartureProvider>
        </StrictMode>
      ),
    });
    act(() => result.current.departure?.flush());
    expect(flush).toHaveBeenCalledOnce();
  });

  it("flushes before push and replace, and leaves traversal alone", () => {
    const flush = vi.fn();
    const { result } = renderHook(() => useRegisteredNavigation(flush), {
      wrapper: ListDepartureProvider,
    });
    const router = useRouter();
    vi.mocked(router.push).mockImplementationOnce(() => {
      expect(flush).toHaveBeenCalledTimes(1);
    });
    vi.mocked(router.replace).mockImplementationOnce(() => {
      expect(flush).toHaveBeenCalledTimes(2);
    });
    act(() => {
      result.current.router.push("/detail", { scroll: false });
      result.current.router.replace("/other");
      result.current.router.back();
      result.current.router.forward();
    });
    expect(router.push).toHaveBeenCalledWith("/detail", { scroll: false });
    expect(router.replace).toHaveBeenCalledWith("/other");
    expect(flush).toHaveBeenCalledTimes(2);
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.forward).toHaveBeenCalledOnce();
  });

  it("preserves navigation outside the provider", () => {
    const flush = vi.fn();
    const caller = vi.fn();
    const { result } = renderHook(() => useRegisteredNavigation(flush, caller));
    act(() => {
      result.current.navigate({ preventDefault: vi.fn() });
      result.current.router.push("/detail");
    });
    expect(result.current.departure).toBeNull();
    expect(caller).toHaveBeenCalledOnce();
    expect(flush).not.toHaveBeenCalled();
    expect(useRouter().push).toHaveBeenCalledWith("/detail");
  });
});
