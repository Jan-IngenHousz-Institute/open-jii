import { CellValues } from "./cell-values";

// Each expectation is the text dev's warehouse sent for the same value (4 November).
describe("CellValues.javaDouble", () => {
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
    expect(CellValues.javaDouble(value)).toBe(text);
  });
});

describe("CellValues.payloadCell", () => {
  // A payload's text as Spark writes gold's VARIANT, which is what the warehouse shows.
  const payload = CellValues.payload(
    '{"ECSt":null,"big":123456789012345678901234567890,"empty":{},"plain":0.00000289,"s":"NA","vH+":-2.89E-6,"x":1.5E-4,"y":1.2345678E7}',
  );

  it("reads a field holding null as the warehouse shows it, and a missing field as no value", () => {
    expect(CellValues.payloadCell(payload, "ECSt", "VARIANT")).toBe("null");
    expect(CellValues.payloadCell(payload, "ECSt", "DOUBLE")).toBeNull();
    expect(CellValues.payloadCell(payload, "missing", "VARIANT")).toBeNull();
  });

  it("writes each number as Spark wrote it, a double, a decimal or an integer past 64 bits", () => {
    expect(CellValues.payloadCell(payload, "vH+", "VARIANT")).toBe("-2.89E-6");
    expect(CellValues.payloadCell(payload, "plain", "VARIANT")).toBe("0.00000289");
    expect(CellValues.payloadCell(payload, "big", "VARIANT")).toBe(
      "123456789012345678901234567890",
    );
    expect(CellValues.payloadCell(payload, "x", "DOUBLE")).toBe("1.5E-4");
    expect(CellValues.payloadCell(payload, "y", "VARIANT")).toBe("1.2345678E7");
    expect(CellValues.payloadCell(payload, "s", "VARIANT")).toBe('"NA"');
  });

  it("reads an empty object as the warehouse does, as a variant or a struct", () => {
    expect(CellValues.payloadCell(payload, "empty", "VARIANT")).toBe("{}");
    expect(CellValues.payloadCell(payload, "empty", "STRUCT<a: DOUBLE>")).toBe('{"a":null}');
  });

  it("reads a whole payload, and nothing for a row without text", () => {
    expect(CellValues.payloadCell(CellValues.payload("[0.7,1]"), undefined, "ARRAY<DOUBLE>")).toBe(
      '["0.7","1.0"]',
    );
    expect(CellValues.payloadCell(CellValues.payload("null"), undefined, "VARIANT")).toBe("null");
    expect(CellValues.payloadCell(CellValues.payload(null), "vH+", "VARIANT")).toBeNull();
  });
});

describe("CellValues.text", () => {
  it("writes a time in UTC to the millisecond, cut rather than rounded", () => {
    expect(CellValues.text("2026-09-14 16:56:31.999600", "TIMESTAMP")).toBe(
      "2026-09-14T16:56:31.999Z",
    );
    expect(CellValues.text("2026-09-14 16:56:31", "TIMESTAMP")).toBe("2026-09-14T16:56:31.000Z");
  });

  it("writes a double JSON has no number for as Java does, from the store's quoted text", () => {
    expect(CellValues.text("nan", "DOUBLE")).toBe("NaN");
    expect(CellValues.text("inf", "DOUBLE")).toBe("Infinity");
    expect(CellValues.text("-inf", "DOUBLE")).toBe("-Infinity");
  });

  it("writes scalars as text", () => {
    expect(CellValues.text("9007199254740993", "BIGINT")).toBe("9007199254740993");
    expect(CellValues.text(true, "BOOLEAN")).toBe("true");
    expect(CellValues.text("2026-09-14", "DATE")).toBe("2026-09-14");
    expect(CellValues.text(52.1, "DOUBLE")).toBe("52.1");
    expect(CellValues.text(null, "DOUBLE")).toBeNull();
  });

  it("writes every leaf of an array or struct as text, and every field of a struct", () => {
    expect(CellValues.text("[1,2.5,3]", "ARRAY<DOUBLE>")).toBe('["1.0","2.5","3.0"]');
    expect(CellValues.text("[[1,2],[3]]", "ARRAY<ARRAY<BIGINT>>")).toBe('[["1","2"],["3"]]');
    expect(CellValues.text('["x",null]', "ARRAY<STRING>")).toBe('["x",null]');
    expect(CellValues.text('{"x":1.5,"y":"s"}', "STRUCT<x: DOUBLE, y: STRING, z: DOUBLE>")).toBe(
      '{"x":"1.5","y":"s","z":null}',
    );
    expect(
      CellValues.text('[{"k":1},{"j":"x","k":2.5}]', "ARRAY<STRUCT<j: STRING, k: DOUBLE>>"),
    ).toBe('[{"j":null,"k":"1.0"},{"j":"x","k":"2.5"}]');
  });

  it("writes a struct the store returns as an object, its times included", () => {
    const annotation = {
      id: "a1",
      content: { text: "torn", flagType: null },
      createdAt: "2026-08-25 09:08:36.928000",
    };
    expect(
      CellValues.text(
        [annotation],
        "ARRAY<STRUCT<id: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdAt: TIMESTAMP>>",
      ),
    ).toBe(
      '[{"id":"a1","content":{"text":"torn","flagType":null},"createdAt":"2026-08-25T09:08:36.928Z"}]',
    );
  });

  it("writes a nested variant as its JSON text", () => {
    expect(CellValues.text('[1,"x",{"k":2}]', "ARRAY<VARIANT>")).toBe(
      '["1","\\"x\\"","{\\"k\\":2}"]',
    );
    expect(CellValues.text('{"v":{"k":1.5},"b":true}', "STRUCT<v: VARIANT, b: BOOLEAN>")).toBe(
      '{"v":"{\\"k\\":1.5}","b":"true"}',
    );
  });

  it("writes a variant with its keys in order and an exponent as a double", () => {
    expect(CellValues.text('{"z":1,"a":0.5,"m":1e-7}', "VARIANT")).toBe(
      '{"a":0.5,"m":1.0E-7,"z":1}',
    );
    expect(CellValues.text('{"c":12345678901234567890}', "VARIANT")).toBe(
      '{"c":12345678901234567890}',
    );
    expect(CellValues.text('"x"', "VARIANT")).toBe('"x"');
  });
});
