import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUrlState } from "./useUrlState";

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

const mockedRouter = nav.useRouter();
const mockedReplace = vi.mocked(mockedRouter.replace);
const mockedPush = vi.mocked(mockedRouter.push);

const stringSerializer = (value: string) => (value === "" ? null : value);
const stringParser = (raw: string | null) => raw ?? "";

describe("useUrlState", () => {
  beforeEach(() => {
    mockedReplace.mockClear();
    mockedPush.mockClear();
    setSearchParams("");
    vi.mocked(nav.usePathname).mockReturnValue("/page");
  });

  afterEach(() => {
    vi.mocked(nav.useSearchParams).mockReset();
    vi.mocked(nav.usePathname).mockReset();
  });

  it("seeds state from the URL on first render", () => {
    setSearchParams("q=hello");
    const { result } = renderHook(() =>
      useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }),
    );
    expect(result.current[0]).toBe("hello");
  });

  it("does not write the URL on mount when state already matches", () => {
    setSearchParams("q=hello");
    renderHook(() => useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }));
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("writes via router.replace when state changes", () => {
    const { result } = renderHook(() =>
      useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }),
    );

    act(() => {
      result.current[1]("hi");
    });

    expect(mockedReplace).toHaveBeenCalledWith("/page?q=hi", { scroll: false });
  });

  it("uses router.push when method is push", () => {
    const { result } = renderHook(() =>
      useUrlState({
        key: "q",
        serialize: stringSerializer,
        parse: stringParser,
        method: "push",
      }),
    );

    act(() => {
      result.current[1]("hi");
    });

    expect(mockedPush).toHaveBeenCalledWith("/page?q=hi", { scroll: false });
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("deletes the key from the URL when serializer returns null", () => {
    setSearchParams("q=hello");
    const { result } = renderHook(() =>
      useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }),
    );

    act(() => {
      result.current[1]("");
    });

    const target = mockedReplace.mock.calls.at(-1)?.[0];
    expect(typeof target).toBe("string");
    if (typeof target === "string") {
      expect(target).not.toContain("q=");
    }
  });

  it("re-seeds state when the URL param changes externally (bidirectional)", () => {
    setSearchParams("q=v1");
    const { result, rerender } = renderHook(() =>
      useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }),
    );
    expect(result.current[0]).toBe("v1");

    setSearchParams("q=v2");
    rerender();

    expect(result.current[0]).toBe("v2");
  });

  it("ignores external URL changes when bidirectional is false", () => {
    setSearchParams("q=v1");
    const { result, rerender } = renderHook(() =>
      useUrlState({
        key: "q",
        serialize: stringSerializer,
        parse: stringParser,
        bidirectional: false,
      }),
    );
    expect(result.current[0]).toBe("v1");

    setSearchParams("q=v2");
    rerender();

    expect(result.current[0]).toBe("v1");
  });

  it("preserves unrelated URL params during write", () => {
    setSearchParams("other=keep&q=hello");
    const { result } = renderHook(() =>
      useUrlState({ key: "q", serialize: stringSerializer, parse: stringParser }),
    );

    act(() => {
      result.current[1]("world");
    });

    const target = mockedReplace.mock.calls.at(-1)?.[0];
    expect(typeof target).toBe("string");
    if (typeof target === "string") {
      expect(target).toContain("other=keep");
      expect(target).toContain("q=world");
    }
  });
});
