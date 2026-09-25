import { FlattenedFields } from "./flattened-fields";

const keys = (reserved: string[], sources: { column: string; schema: string; suffix: string }[]) =>
  FlattenedFields.resolve(reserved, sources).map(({ key, column, field }) => [
    key,
    column,
    field.name,
  ]);

describe("FlattenedFields.resolve", () => {
  it("keeps a field's own name when nothing holds it", () => {
    expect(
      keys(
        ["id", "timestamp"],
        [{ column: "m", schema: "OBJECT<phi2: DOUBLE>", suffix: "output" }],
      ),
    ).toEqual([["phi2", "m", "phi2"]]);
  });

  it("renames a field whose name a base column holds, ignoring case", () => {
    expect(
      keys(
        ["id", "device"],
        [{ column: "m", schema: "OBJECT<Device: STRING, ID: BIGINT>", suffix: "output" }],
      ),
    ).toEqual([
      ["Device_output", "m", "Device"],
      ["ID_output", "m", "ID"],
    ]);
  });

  it("renames a field whose name an earlier VARIANT column holds", () => {
    expect(
      keys(
        [],
        [
          { column: "m", schema: "OBJECT<time: STRING>", suffix: "output" },
          { column: "q", schema: "OBJECT<time: STRING>", suffix: "answer" },
        ],
      ),
    ).toEqual([
      ["time", "m", "time"],
      ["time_answer", "q", "time"],
    ]);
  });

  it("never takes the name of a field that did not clash", () => {
    expect(
      keys(
        ["device"],
        [
          {
            column: "m",
            schema: "OBJECT<device: STRING, device_output: STRING>",
            suffix: "output",
          },
        ],
      ),
    ).toEqual([
      ["device_output_2", "m", "device"],
      ["device_output", "m", "device_output"],
    ]);
  });

  it("numbers the suffixed name when a base column already holds it", () => {
    expect(
      keys(
        ["device", "device_output"],
        [{ column: "m", schema: "OBJECT<device: STRING>", suffix: "output" }],
      ),
    ).toEqual([["device_output_2", "m", "device"]]);
  });

  it("holds the name of a VARIANT read whole", () => {
    expect(
      keys(
        [],
        [
          { column: "m", schema: "OBJECT<q: STRING>", suffix: "output" },
          { column: "q", schema: "ARRAY<STRING>", suffix: "answer" },
        ],
      ),
    ).toEqual([["q_output", "m", "q"]]);
  });

  it("gives the same names for the same inputs", () => {
    const sources = [{ column: "m", schema: "OBJECT<id: STRING, x: INT>", suffix: "output" }];

    expect(FlattenedFields.resolve(["id"], sources)).toEqual(
      FlattenedFields.resolve(["id"], sources),
    );
  });
});
