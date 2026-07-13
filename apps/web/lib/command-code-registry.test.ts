import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetProtocolCodeRegistry,
  getLiveProtocolCode,
  registerProtocolCodeSource,
} from "./protocol-code-registry";

describe("protocol-code-registry", () => {
  beforeEach(() => {
    __resetProtocolCodeRegistry();
  });

  it("returns null for an unregistered protocol", () => {
    expect(getLiveProtocolCode("missing")).toBeNull();
  });

  it("returns the live code from the registered source", () => {
    const code = [{ _protocol_set_: [] }];
    registerProtocolCodeSource("p1", () => code);

    expect(getLiveProtocolCode("p1")).toBe(code);
  });

  it("reflects the source's latest value on each read", () => {
    let current: Record<string, unknown>[] | null = [{ v: 1 }];
    registerProtocolCodeSource("p1", () => current);

    expect(getLiveProtocolCode("p1")).toEqual([{ v: 1 }]);
    current = [{ v: 2 }];
    expect(getLiveProtocolCode("p1")).toEqual([{ v: 2 }]);
  });

  it("returns null when the source reports invalid code", () => {
    registerProtocolCodeSource("p1", () => null);

    expect(getLiveProtocolCode("p1")).toBeNull();
  });

  it("only reads the requested protocol's source", () => {
    const a = vi.fn(() => [{ a: 1 }]);
    const b = vi.fn(() => [{ b: 1 }]);
    registerProtocolCodeSource("a", a);
    registerProtocolCodeSource("b", b);

    getLiveProtocolCode("a");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("the returned cleanup unregisters the source", () => {
    const unregister = registerProtocolCodeSource("p1", () => [{ v: 1 }]);

    unregister();

    expect(getLiveProtocolCode("p1")).toBeNull();
  });

  it("cleanup does not remove a newer source for the same id", () => {
    const unregisterFirst = registerProtocolCodeSource("p1", () => [{ v: 1 }]);
    registerProtocolCodeSource("p1", () => [{ v: 2 }]);

    // The first editor unmounting must not clobber the second editor's source.
    unregisterFirst();

    expect(getLiveProtocolCode("p1")).toEqual([{ v: 2 }]);
  });
});
