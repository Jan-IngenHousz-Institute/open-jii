import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { StoreQueryBuilder } from "./store-query-builder";
import { MACRO_RESULTS_TABLE, MEASUREMENTS_TABLE, UPLOADS_TABLE } from "./store-tables";

describe("StoreQueryBuilder", () => {
  const measurements = () => new StoreQueryBuilder().read(MEASUREMENTS_TABLE, "e1");

  it("reads one experiment through its view, and one macro table among its rows", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e'1", "m1")
      .select(["id"])
      .build();

    expect(sql).toBe(
      "SELECT toString(id) AS `id`\nFROM experiment_macro_results(experiment = 'e\\'1')\nWHERE macro_id = 'm1'",
    );
  });

  it("projects the view's columns in its order, hiding the payloads and the excepted ones", () => {
    const builder = measurements()
      .parseVariant("questions_data", "OBJECT<plot: STRING>", "answer")
      .except(["experiment_id", "custom_metadata"]);

    const names = builder.outputColumns().map(({ name }) => name);
    expect(names).toEqual([
      "id",
      "device_id",
      "device_name",
      "timestamp",
      "measurement_time_utc",
      "timezone",
      "date",
      "macros",
      "contributor",
      "device",
      "protocol_id",
      "workbook_run_id",
      "latitude",
      "longitude",
      "data",
      "processed_timestamp",
      "measurement_time_local",
      "local_time",
      "annotations",
      "plot",
    ]);
    expect(builder.build()).toContain("questions_data['plot'] AS `plot`");
  });

  it("types contributors and devices as the warehouse does, holding their ids", () => {
    const columns = measurements().select(["contributor", "device"]).outputColumns();

    expect(columns).toEqual([
      expect.objectContaining({ name: "contributor", idOf: "contributor" }),
      expect.objectContaining({ name: "device", idOf: "device" }),
    ]);
    expect(measurements().select(["contributor", "device"]).build()).toContain(
      "SELECT user_id AS `contributor`, client_id AS `device`",
    );
  });

  it("reads a scalar field by type, anything else as JSON, and an empty object as null", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m1")
      .parseVariant(
        "macro_output",
        "OBJECT<PAR: BIGINT, `Plot no.`: DOUBLE, nested: OBJECT<x: DOUBLE>, trace: ARRAY<DOUBLE>, mixed: VARIANT, dead: VOID>",
        "output",
      )
      .select(["PAR", "Plot no.", "nested", "trace", "mixed", "dead"])
      .build();

    expect(sql).toContain("toString(accurateCastOrNull(macro_output.`PAR`, 'Int64')) AS `PAR`");
    expect(sql).toContain("accurateCastOrNull(macro_output.`Plot no%2E`, 'Float64') AS `Plot no.`");
    expect(sql).toContain(
      "if(length(JSONAllPaths(assumeNotNull(macro_output.^`nested`))) = 0, NULL, toJSONString(macro_output.^`nested`)) AS `nested`",
    );
    expect(sql).toContain("toJSONString(macro_output.`trace`) AS `trace`");
    expect(sql).toContain(
      "if(dynamicType(macro_output.`mixed`) != 'None', toJSONString(macro_output.`mixed`), if(",
    );
    expect(sql).toContain("accurateCastOrNull(macro_output.`dead`, 'String') AS `dead`");
  });

  it("escapes backslashes in a quoted name, which the store reads as escapes", () => {
    const sql = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .parseVariant("uploaded_data", "OBJECT<`Temp\\`: BIGINT, `a``b`: STRING>", "upload")
      .select(["Temp\\", "a`b"])
      .build();

    expect(sql).toContain("uploaded_data.`Temp\\\\`, 'Int64')) AS `Temp\\\\`");
    expect(sql).toContain("uploaded_data.`a\\`b`, 'String') AS `a\\`b`");
  });

  it("reads a payload the feed wrapped because it was no object", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m2")
      .parseVariant("macro_output", "ARRAY<OBJECT<k: DOUBLE>>", "output")
      .select(["macro_output"])
      .build();

    expect(sql).toContain("toJSONString(macro_output._items) AS `macro_output`");
  });

  it("compares times, dates and text in the store's own types", () => {
    const sql = measurements()
      .select(["id"])
      .filter({ column: "timestamp", operator: "greater_than", value: "2026-09-14T00:00:00Z" })
      .filter({ column: "date", operator: "equals", value: "2026-09-14" })
      .filter({ column: "device_id", operator: "in", value: [7, "d1"] })
      .filter({ column: "protocol_id", operator: "contains", value: "50%" })
      .build();

    expect(sql).toContain(
      "timestamp > parseDateTime64BestEffortOrNull('2026-09-14T00:00:00Z', 6, 'UTC')",
    );
    expect(sql).toContain(
      "toDate(timestamp) = toDate(parseDateTime64BestEffortOrNull('2026-09-14', 6, 'UTC'))",
    );
    expect(sql).toContain("device_id IN ('7', 'd1')");
    expect(sql).toContain("toString(protocol_id) LIKE '%50%%'");
  });

  it("filters a contributor by id, and by the pseudonym an anonymized picker sends", () => {
    const sql = measurements()
      .select(["id"])
      .filter({
        column: "contributor.id",
        operator: "equals",
        value: "Contributor-ABC123",
        contributorPseudonymSalt: "e1",
      })
      .build();

    expect(sql).toContain(
      "concat('Contributor-', substring(hex(SHA256(concat('e1:', user_id))), 1, 6)) = 'Contributor-ABC123'",
    );
  });

  it("filters and sorts a device's serial number through the serials it is given", () => {
    const sql = measurements()
      .select(["id"])
      .serialNumbers([
        ["thing-1", "SN-1"],
        ["thing-2", null],
      ])
      .filter({ column: "device.serial_number", operator: "equals", value: "SN-1" })
      .orderBy({ column: "device.serial_number", direction: "DESC" })
      .build();

    const serial =
      "arrayElement(CAST(['SN-1', NULL] AS Array(Nullable(String))), indexOf(['thing-1', 'thing-2'], client_id))";
    expect(sql).toContain(`WHERE ${serial} = 'SN-1'`);
    expect(sql).toContain(`ORDER BY ${serial} DESC NULLS LAST`);
  });

  it("sorts text that holds a number by its value, then by the text and the row id", () => {
    const sql = measurements()
      .parseVariant("questions_data", "OBJECT<plot: STRING>", "answer")
      .select(["plot"])
      .orderBy({ column: "plot", direction: "DESC", mode: { kind: "numericString", rowId: "id" } })
      .build();

    const answer = "questions_data['plot']";
    expect(sql).toContain(`THEN toDecimal128OrNull(trim(BOTH`);
    expect(sql).toContain(`FROM ${answer}), 18) END) DESC, ${answer} DESC NULLS LAST, id ASC`);
  });

  it("sorts a contributor's name by the place of each row's id, with Spark's null order", () => {
    const sql = measurements()
      .select(["id"])
      .orderBy({ column: "contributor.name", direction: "ASC" }, ["u2", "u1"])
      .build();

    expect(sql).toContain("ORDER BY indexOf(['u2', 'u1'], user_id) ASC NULLS FIRST");
  });

  it("sorts and filters a field by its extraction, never by its output name", () => {
    const sql = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .parseVariant("uploaded_data", "OBJECT<user_id: STRING>", "upload")
      .select(["user_id"])
      .distinct()
      .orderBy({ column: "user_id", direction: "ASC" })
      .limit(11)
      .offset(10)
      .build();

    expect(sql).toBe(
      [
        "SELECT DISTINCT accurateCastOrNull(uploaded_data.`user_id`, 'String') AS `user_id`",
        "FROM experiment_uploads(experiment = 'e1')",
        "WHERE upload_table_id = 't1'",
        "ORDER BY accurateCastOrNull(uploaded_data.`user_id`, 'String') ASC NULLS FIRST",
        "LIMIT 11",
        "OFFSET 10",
      ].join("\n"),
    );
  });

  it("refuses a column the table does not have, and a struct field it cannot read", () => {
    expect(() => measurements().select(["nope"]).build()).toThrow(QueryBuilderInputError);
    expect(() =>
      measurements().filter({ column: "contributor.avatar", operator: "equals", value: "x" }),
    ).toThrow(QueryBuilderInputError);
  });

  it("escapes a value that ends in a backslash or tries to close its quote", () => {
    const sql = measurements()
      .select(["id"])
      .filter({ column: "protocol_id", operator: "equals", value: "p1\\" })
      .filter({ column: "protocol_id", operator: "equals", value: "\\' OR 1=1 --" })
      .build();

    expect(sql).toContain("protocol_id = 'p1\\\\'");
    expect(sql).toContain("protocol_id = '\\\\\\' OR 1=1 --'");
  });

  it("refuses text a number column cannot read, which the store would answer with an error", () => {
    expect(() =>
      measurements().filter({ column: "id", operator: "equals", value: "abc" }).build(),
    ).toThrow(QueryBuilderInputError);
    expect(() =>
      measurements().filter({ column: "id", operator: "equals", value: "1.5" }).build(),
    ).toThrow(QueryBuilderInputError);

    const sql = measurements()
      .select(["id"])
      .filter({ column: "id", operator: "equals", value: "12" })
      .filter({ column: "latitude", operator: "greater_than", value: "-1.5" })
      .build();

    expect(sql).toContain("id = '12'");
    expect(sql).toContain("latitude > '-1.5'");
  });

  it("refuses a number for a time, which the store would answer with an error", () => {
    expect(() =>
      measurements().filter({ column: "date", operator: "equals", value: 5 }).build(),
    ).toThrow(QueryBuilderInputError);
    expect(() =>
      measurements().filter({ column: "timestamp", operator: "greater_than", value: 5 }).build(),
    ).toThrow(QueryBuilderInputError);
  });
});
