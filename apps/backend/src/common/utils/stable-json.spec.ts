import { stableStringify } from "./stable-json";

describe("stableStringify", () => {
  it("should stringify primitive values correctly", () => {
    expect(stableStringify(123)).toBe("123");
    expect(stableStringify("test")).toBe('"test"');
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(undefined)).toBe(undefined);
  });

  it("should produce identical output for objects with same properties in different order", () => {
    const obj1 = {
      b: 2,
      a: 1,
      c: {
        z: 3,
        y: 2,
        x: 1,
      },
    };

    const obj2 = {
      a: 1,
      b: 2,
      c: {
        x: 1,
        y: 2,
        z: 3,
      },
    };

    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    // And they should be different from regular JSON.stringify
    expect(JSON.stringify(obj1)).not.toBe(JSON.stringify(obj2));
  });

  it("should handle arrays correctly", () => {
    const arr1 = [3, 2, 1];
    const arr2 = [3, 2, 1]; // Same order should produce same output
    expect(stableStringify(arr1)).toBe(stableStringify(arr2));

    // Array order matters, so these should be different
    const arr3 = [1, 2, 3];
    expect(stableStringify(arr1)).not.toBe(stableStringify(arr3));
  });

  it("should handle nested objects with arrays", () => {
    const obj1 = {
      items: [
        { id: 2, name: "B" },
        { id: 1, name: "A" },
      ],
      meta: {
        b: "value",
        a: "another",
      },
    };

    const obj2 = {
      meta: {
        a: "another",
        b: "value",
      },
      items: [
        { id: 2, name: "B" },
        { id: 1, name: "A" },
      ],
    };

    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    expect(JSON.stringify(obj1)).not.toBe(JSON.stringify(obj2));
  });

  it("should handle empty objects and arrays", () => {
    expect(stableStringify({})).toBe("{}");
    expect(stableStringify([])).toBe("[]");
  });

  it("should handle complex nested structures", () => {
    const complex1 = {
      c: [
        { z: 3, y: 2, x: 1 },
        { b: 5, a: 4 },
      ],
      b: { d: 9, c: 8, b: 7, a: 6 },
      a: "test",
    };

    const complex2 = {
      a: "test",
      b: { a: 6, b: 7, c: 8, d: 9 },
      c: [
        { x: 1, y: 2, z: 3 },
        { a: 4, b: 5 },
      ],
    };

    expect(stableStringify(complex1)).toBe(stableStringify(complex2));
    expect(JSON.stringify(complex1)).not.toBe(JSON.stringify(complex2));
  });
});
