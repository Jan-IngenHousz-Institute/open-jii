import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetCommandCodeRegistry,
  getLiveCommandCode,
  registerCommandCodeSource,
} from "./command-code-registry";

describe("command-code-registry", () => {
  beforeEach(() => {
    __resetCommandCodeRegistry();
  });

  it("returns null for an unregistered command", () => {
    expect(getLiveCommandCode("missing")).toBeNull();
  });

  it("returns the live code from the registered source", () => {
    const code = [{ _protocol_set_: [] }];
    registerCommandCodeSource("p1", () => code);

    expect(getLiveCommandCode("p1")).toBe(code);
  });

  it("reflects the source's latest value on each read", () => {
    let current: Record<string, unknown>[] | null = [{ v: 1 }];
    registerCommandCodeSource("p1", () => current);

    expect(getLiveCommandCode("p1")).toEqual([{ v: 1 }]);
    current = [{ v: 2 }];
    expect(getLiveCommandCode("p1")).toEqual([{ v: 2 }]);
  });

  it("returns null when the source reports invalid code", () => {
    registerCommandCodeSource("p1", () => null);

    expect(getLiveCommandCode("p1")).toBeNull();
  });

  it("only reads the requested command's source", () => {
    const a = vi.fn(() => [{ a: 1 }]);
    const b = vi.fn(() => [{ b: 1 }]);
    registerCommandCodeSource("a", a);
    registerCommandCodeSource("b", b);

    getLiveCommandCode("a");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("the returned cleanup unregisters the source", () => {
    const unregister = registerCommandCodeSource("p1", () => [{ v: 1 }]);

    unregister();

    expect(getLiveCommandCode("p1")).toBeNull();
  });

  it("cleanup does not remove a newer source for the same id", () => {
    const unregisterFirst = registerCommandCodeSource("p1", () => [{ v: 1 }]);
    registerCommandCodeSource("p1", () => [{ v: 2 }]);

    // The first editor unmounting must not clobber the second editor's source.
    unregisterFirst();

    expect(getLiveCommandCode("p1")).toEqual([{ v: 2 }]);
  });
});
