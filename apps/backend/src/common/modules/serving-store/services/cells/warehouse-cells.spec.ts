import { WarehouseCells } from "./warehouse-cells";

// Each expectation is the text dev's warehouse sent for the same value (4 November).
describe("WarehouseCells.javaDouble", () => {
  it.each([
    [3, "3.0"],
    [0.1, "0.1"],
    [1e-7, "1.0E-7"],
    [1e21, "1.0E21"],
    [123456789.125, "1.23456789125E8"],
    [1234567, "1234567.0"],
    [0.001, "0.001"],
    [9999999, "9999999.0"],
    [1e7, "1.0E7"],
    [-2.5, "-2.5"],
    [0, "0.0"],
    [Number.NaN, "NaN"],
  ])("writes %d as %s", (value, text) => {
    expect(WarehouseCells.javaDouble(value)).toBe(text);
  });
});

describe("WarehouseCells.text", () => {
  it("writes a time in UTC to the millisecond, cut rather than rounded", () => {
    expect(WarehouseCells.text("2026-09-14 16:56:31.999600", "TIMESTAMP")).toBe(
      "2026-09-14T16:56:31.999Z",
    );
    expect(WarehouseCells.text("2026-09-14 16:56:31", "TIMESTAMP")).toBe(
      "2026-09-14T16:56:31.000Z",
    );
  });

  it("writes scalars as text", () => {
    expect(WarehouseCells.text("9007199254740993", "BIGINT")).toBe("9007199254740993");
    expect(WarehouseCells.text(true, "BOOLEAN")).toBe("true");
    expect(WarehouseCells.text("2026-09-14", "DATE")).toBe("2026-09-14");
    expect(WarehouseCells.text(52.1, "DOUBLE")).toBe("52.1");
    expect(WarehouseCells.text(null, "DOUBLE")).toBeNull();
  });

  it("writes every leaf of an array or struct as text, and every field of a struct", () => {
    expect(WarehouseCells.text("[1,2.5,3]", "ARRAY<DOUBLE>")).toBe('["1.0","2.5","3.0"]');
    expect(WarehouseCells.text("[[1,2],[3]]", "ARRAY<ARRAY<BIGINT>>")).toBe('[["1","2"],["3"]]');
    expect(WarehouseCells.text('["x",null]', "ARRAY<STRING>")).toBe('["x",null]');
    expect(
      WarehouseCells.text('{"x":1.5,"y":"s"}', "STRUCT<x: DOUBLE, y: STRING, z: DOUBLE>"),
    ).toBe('{"x":"1.5","y":"s","z":null}');
    expect(
      WarehouseCells.text('[{"k":1},{"j":"x","k":2.5}]', "ARRAY<STRUCT<j: STRING, k: DOUBLE>>"),
    ).toBe('[{"j":null,"k":"1.0"},{"j":"x","k":"2.5"}]');
  });

  it("writes a struct the store returns as an object, its times included", () => {
    const annotation = {
      id: "a1",
      content: { text: "torn", flagType: null },
      createdAt: "2026-08-25 09:08:36.928000",
    };
    expect(
      WarehouseCells.text(
        [annotation],
        "ARRAY<STRUCT<id: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdAt: TIMESTAMP>>",
      ),
    ).toBe(
      '[{"id":"a1","content":{"text":"torn","flagType":null},"createdAt":"2026-08-25T09:08:36.928Z"}]',
    );
  });

  it("writes a nested variant as its JSON text", () => {
    expect(WarehouseCells.text('[1,"x",{"k":2}]', "ARRAY<VARIANT>")).toBe(
      '["1","\\"x\\"","{\\"k\\":2}"]',
    );
    expect(WarehouseCells.text('{"v":{"k":1.5},"b":true}', "STRUCT<v: VARIANT, b: BOOLEAN>")).toBe(
      '{"v":"{\\"k\\":1.5}","b":"true"}',
    );
  });

  it("writes a variant with its keys in order and an exponent as a double", () => {
    expect(WarehouseCells.text('{"z":1,"a":0.5,"m":1e-7}', "VARIANT")).toBe(
      '{"a":0.5,"m":1.0E-7,"z":1}',
    );
    expect(WarehouseCells.text('{"c":12345678901234567890}', "VARIANT")).toBe(
      '{"c":12345678901234567890}',
    );
    expect(WarehouseCells.text('"x"', "VARIANT")).toBe('"x"');
  });
});
