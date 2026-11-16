import { deviceLabel } from "../../../databricks/services/query-builder/expressions/device-label";
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

  it("keeps the rows flagged on the phone or afterwards, or only the rows neither flagged", () => {
    const only = measurements().select(["id"]).flagged("only", ["7", "9"]).build();
    const exclude = measurements().select(["id"]).flagged("exclude", ["7", "9"]).build();

    const flaggedCondition =
      "(toString(id) IN (SELECT arrayJoin(__flagged_row_ids)) OR arrayExists(annotation -> tupleElement(annotation, 'type') = 'flag', annotations))";
    expect(only).toMatch(/^WITH CAST\(\['7', '9'\] AS Array\(String\)\) AS __flagged_row_ids\n/);
    expect(only).toContain(`WHERE ${flaggedCondition}`);
    expect(exclude).toContain(`WHERE NOT ${flaggedCondition}`);
  });

  it("looks for an upload table's flags only among those added afterwards", () => {
    const sql = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .select(["id"])
      .flagged("only", [])
      .build();

    expect(sql).toContain("WITH CAST([] AS Array(String)) AS __flagged_row_ids");
    expect(sql).toContain("AND toString(id) IN (SELECT arrayJoin(__flagged_row_ids))");
    expect(sql).not.toContain("arrayExists");
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
    const sql = measurements().select(["contributor", "device"]).build();
    expect(sql).toContain("SELECT user_id AS `contributor`, tuple(client_id, CASE WHEN ");
    expect(sql).toContain("nullif(trim(device_name), ''), nullif(trim(client_id), '')");
  });

  it("reads a field from the JSON column by type for a distinct read, anything else as JSON", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m1")
      .parseVariant(
        "macro_output",
        "OBJECT<PAR: BIGINT, `Plot no.`: DOUBLE, nested: OBJECT<x: DOUBLE>, trace: ARRAY<DOUBLE>, mixed: VARIANT, dead: VOID>",
        "output",
      )
      .select(["PAR", "Plot no.", "nested", "trace", "mixed", "dead"])
      .distinct()
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

  it("shows a payload's fields from its text, carried once, and filters and sorts by its JSON column", () => {
    const builder = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m1")
      .parseVariant("macro_output", "OBJECT<`vH+`: VARIANT, PAR: DOUBLE>", "output")
      .parseVariant("questions_data", "OBJECT<plot: STRING>", "answer")
      .select(["id", "vH+", "PAR", "plot"])
      .filter({ column: "PAR", operator: "greater_than", value: 1 })
      .orderBy({ column: "vH+", direction: "ASC" });
    const sql = builder.build();

    expect(builder.outputColumns().map(({ text }) => text)).toEqual([
      undefined,
      { column: "macro_output_text", key: "vH+" },
      { column: "macro_output_text", key: "PAR" },
      undefined,
    ]);
    expect(sql).toContain(
      "SELECT toString(id) AS `id`, macro_output_text AS `vH+`, NULL AS `PAR`, questions_data['plot'] AS `plot`",
    );
    expect(sql).toContain("accurateCastOrNull(macro_output.`PAR`, 'Float64') > 1");
    expect(sql).toContain("ORDER BY if(dynamicType(macro_output.`vH+`) != 'None'");
  });

  it("reads a chart's payload fields as values from the JSON column, never the payload's text", () => {
    const builder = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m1")
      .plotValues()
      .parseVariant("macro_output", "OBJECT<PAR: DOUBLE>", "output")
      .select(["id", "PAR"]);
    const sql = builder.build();

    expect(builder.outputColumns().map(({ text }) => text)).toEqual([undefined, undefined]);
    expect(sql).toContain("accurateCastOrNull(macro_output.`PAR`, 'Float64') AS `PAR`");
    expect(sql).not.toContain("macro_output_text");
  });

  it("escapes backslashes in a quoted name, which the store reads as escapes", () => {
    const sql = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .parseVariant("uploaded_data", "OBJECT<`Temp\\`: BIGINT, `a``b`: STRING>", "upload")
      .select(["Temp\\", "a`b"])
      .distinct()
      .build();

    expect(sql).toContain("uploaded_data.`Temp\\\\`, 'Int64')) AS `Temp\\\\`");
    expect(sql).toContain("uploaded_data.`a\\`b`, 'String') AS `a\\`b`");
  });

  it("reads a payload the feed wrapped because it was no object", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m2")
      .parseVariant("macro_output", "ARRAY<OBJECT<k: DOUBLE>>", "output")
      .select(["macro_output"])
      .distinct()
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

  it("filters, sorts and lists a device by the warehouse's label, from the serials it is given", () => {
    const builder = measurements()
      .select(["device.serial_number"])
      .serialNumbers([
        ["thing-1", "SN-1"],
        ["thing-2", "SN-2"],
      ])
      .filter({ column: "device.serial_number", operator: "equals", value: "SN-1" })
      .orderBy({ column: "device.serial_number", direction: "DESC" });
    const sql = builder.build();

    const label = deviceLabel({
      serialNumber:
        "transform(client_id, __device_client_ids, __device_serials, CAST(NULL AS Nullable(String)))",
      deviceName: "device_name",
      deviceId: "device_id",
      clientId: "client_id",
    });
    expect(sql).toMatch(
      /^WITH \['thing-1', 'thing-2'\] AS __device_client_ids, CAST\(\['SN-1', 'SN-2'\] AS Array\(Nullable\(String\)\)\) AS __device_serials\n/,
    );
    expect(sql).toContain(`SELECT ${label} AS \`device.serial_number\``);
    expect(sql).toContain(`WHERE ${label} = 'SN-1'`);
    expect(sql).toContain(`ORDER BY ${label} DESC NULLS LAST`);
    expect(builder.outputColumns()).toEqual([{ name: "device.serial_number", type: "STRING" }]);
  });

  it("sorts a whole device by the registry's order of the ids it is given, then by its label", () => {
    const sql = measurements()
      .select(["id"])
      .orderBy({ column: "device", direction: "ASC" }, ["thing-2", "thing-1"])
      .build();

    expect(sql).toMatch(/^WITH \['thing-2', 'thing-1'\] AS __order_ids\n/);
    expect(sql).toContain("ORDER BY indexOf(__order_ids, client_id) ASC NULLS FIRST, CASE WHEN ");
    expect(sql).toMatch(/ END ASC NULLS FIRST$/);
  });

  it("writes each list a sorted page reads once, so 2,500 registered devices stay under 1 MiB", () => {
    const devices = Array.from({ length: 2_500 }, (_, index): [string, string] => [
      `mobile_${String(index).padStart(36, "0")}`,
      `MSQ-${String(index).padStart(10, "0")}`,
    ]);
    const sql = measurements()
      .serialNumbers(devices)
      .filter({ column: "device.serial_number", operator: "contains", value: "MSQ" })
      .orderBy(
        { column: "device", direction: "DESC" },
        devices.map(([clientId]) => clientId),
      )
      .limit(100)
      .offset(200)
      .build();

    expect(sql.split(devices[1234][0])).toHaveLength(3);
    expect(Buffer.byteLength(sql)).toBeLessThan(1_048_576);
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

  it("reads, sorts and filters a Number question's answers as numbers, as the warehouse does", () => {
    const sql = measurements()
      .parseVariant("questions_data", "OBJECT<height: DOUBLE, plot: STRING>", "answer")
      .select(["height"])
      .filter({ column: "height", operator: "equals", value: "n/a" })
      .filter({ column: "height", operator: "greater_than", value: 10 })
      .filter({ column: "plot", operator: "equals", value: "007" })
      .orderBy({ column: "height", direction: "DESC", mode: { kind: "number", rowId: "id" } })
      .build();

    const answer = "questions_data['height']";
    const height = `toFloat64OrNull(replaceRegexpOne(replaceRegexpAll(${answer}, `;
    expect(sql).toContain(`SELECT ${height}`);
    expect(sql).toContain("toFloat64OrNull(replaceRegexpOne(replaceRegexpAll('n/a', ");
    expect(sql).toContain(") > 10");
    expect(sql).toContain("questions_data['plot'] = '007'");
    expect(sql).toMatch(
      /ORDER BY isNaN\(toFloat64OrNull\(.*\)\) DESC NULLS LAST, toFloat64OrNull\(.*\) DESC NULLS LAST, id ASC$/,
    );
  });

  it("sorts a double with NaN above every number, as Spark does, and text without", () => {
    const sorted = (column: string) =>
      new StoreQueryBuilder()
        .read(UPLOADS_TABLE, "e1", "t1")
        .parseVariant("uploaded_data", "OBJECT<h: DOUBLE, plot: STRING>", "upload")
        .select([column])
        .orderBy({ column, direction: "ASC" })
        .build();

    const h = "accurateCastOrNull(uploaded_data.`h`, 'Float64')";
    expect(sorted("h")).toContain(`ORDER BY isNaN(${h}) ASC NULLS FIRST, ${h} ASC NULLS FIRST`);
    expect(sorted("plot")).not.toContain("isNaN");
  });

  it("compares a payload's BIGINT with text as two doubles, as Spark does", () => {
    const sql = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .parseVariant("uploaded_data", "OBJECT<plot: BIGINT>", "upload")
      .select(["plot"])
      .filter({ column: "plot", operator: "in", value: ["9007199254740993"] })
      .filter({ column: "plot", operator: "greater_than", value: 5 })
      .filter({ column: "plot", operator: "contains", value: "900" })
      .build();

    const plot = "accurateCastOrNull(uploaded_data.`plot`, 'Int64')";
    expect(sql).toContain(`toFloat64(${plot}) IN (toFloat64OrNull(`);
    expect(sql).toContain(`${plot} > 5`);
    expect(sql).not.toContain(`toFloat64(${plot}) > 5`);
    expect(sql).toContain(`toString(${plot}) LIKE '%900%'`);
  });

  it("sorts a contributor's name by the place of each row's id, with Spark's null order", () => {
    const sql = measurements()
      .select(["id"])
      .orderBy({ column: "contributor.name", direction: "ASC" }, ["u2", "u1"])
      .build();

    expect(sql).toMatch(/^WITH \['u2', 'u1'\] AS __order_ids\n/);
    expect(sql).toContain("ORDER BY indexOf(__order_ids, user_id) ASC NULLS FIRST");
  });

  it("renames a payload field that takes the name of a list the statement holds", () => {
    const builder = new StoreQueryBuilder()
      .read(UPLOADS_TABLE, "e1", "t1")
      .parseVariant("uploaded_data", "OBJECT<__order_ids: STRING>", "upload")
      .select(["id", "__order_ids_upload"])
      .orderBy({ column: "contributor.name", direction: "ASC" }, ["u1"]);
    const sql = builder.build();

    expect(builder.outputColumns().map(({ name }) => name)).toEqual(["id", "__order_ids_upload"]);
    expect(sql).toMatch(/^WITH \['u1'\] AS __order_ids\n/);
    expect(sql).toContain("uploaded_data_text AS `__order_ids_upload`");
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

  it("finds a sorted page's rows by key first, then reads only those rows", () => {
    const sql = new StoreQueryBuilder()
      .read(MACRO_RESULTS_TABLE, "e1", "m1")
      .select(["id"])
      .filter({ column: "device_id", operator: "equals", value: "d1" })
      .orderBy({ column: "timestamp", direction: "DESC" })
      .limit(10)
      .offset(20)
      .build();

    const key =
      "ifNull(macro_id, ''), timestamp, raw_id, ifNull(macro_filename, ''), ifNull(device_id, '')";
    expect(sql).toBe(
      [
        "SELECT toString(id) AS `id`",
        "FROM experiment_macro_results(experiment = 'e1')",
        `WHERE (${key}) IN (SELECT ${key}`,
        "FROM experiment_macro_results(experiment = 'e1')",
        "WHERE macro_id = 'm1' AND device_id = 'd1'",
        `ORDER BY timestamp DESC NULLS LAST, ${key}`,
        "LIMIT 10",
        "OFFSET 20)",
        "ORDER BY timestamp DESC NULLS LAST",
      ].join("\n"),
    );
  });

  describe("custom metadata", () => {
    const sheets = [
      {
        id: "s1",
        matchOn: "plot",
        schema: "OBJECT<area: DECIMAL(4,2), soil: STRING>",
        version: "1",
      },
      { id: "s2", matchOn: "column:device_id", schema: "OBJECT<area: BIGINT>", version: "2" },
      { id: "s3", matchOn: "column:timezone", schema: "OBJECT<soil: STRING>", version: "3" },
    ];
    const withMetadata = () =>
      measurements()
        .parseVariant("custom_metadata", "OBJECT<area: DECIMAL(4,2), soil: STRING>", "metadata")
        .metadataSheets(sheets);
    const key = "timestamp, id, ifNull(device_id, '')";

    it("reads a field's text from the newest sheet holding it, a decimal at its scale", () => {
      const sql = withMetadata().select(["area"]).build();

      const text =
        "multiIf(simpleJSONHas(sheet_1_fields, 'area'), simpleJSONExtractRaw(sheet_1_fields, 'area'), simpleJSONHas(sheet_0_fields, 'area'), simpleJSONExtractRaw(sheet_0_fields, 'area'), NULL)";
      expect(sql).toContain(
        `toDecimalString(accurateCastOrNull(${text}, 'Decimal(4, 2)'), 2) AS \`area\``,
      );
    });

    it("reads a sheet whose rows hold objects by their top-level keys alone", () => {
      const nested = "OBJECT<extra: OBJECT<soil: STRING>, soil: STRING>";
      const sql = measurements()
        .parseVariant("custom_metadata", nested, "metadata")
        .metadataSheets([{ id: "s1", matchOn: "plot", schema: nested, version: "1" }])
        .select(["soil"])
        .build();

      expect(sql).toContain(
        "JSONExtract(multiIf(JSONHas(sheet_0_fields, 'soil'), JSONExtractRaw(sheet_0_fields, 'soil'), NULL), 'Nullable(String)') AS `soil`",
      );
    });

    it("reads a sheet with a mix of kinds by its top-level keys alone, since a mix can hold an object", () => {
      const sql = measurements()
        .parseVariant(
          "custom_metadata",
          "OBJECT<extra: VARIANT, soil: STRING, tags: ARRAY<VARIANT>>",
          "metadata",
        )
        .metadataSheets([
          {
            id: "s1",
            matchOn: "plot",
            schema: "OBJECT<extra: VARIANT, soil: STRING>",
            version: "1",
          },
          {
            id: "s2",
            matchOn: "plot",
            schema: "OBJECT<soil: STRING, tags: ARRAY<VARIANT>>",
            version: "2",
          },
        ])
        .select(["soil"])
        .build();

      expect(sql).toContain(
        "multiIf(JSONHas(sheet_1_fields, 'soil'), JSONExtractRaw(sheet_1_fields, 'soil'), JSONHas(sheet_0_fields, 'soil'), JSONExtractRaw(sheet_0_fields, 'soil'), NULL)",
      );
    });

    it("asks only the sheets whose schema holds the field", () => {
      const sql = withMetadata().select(["soil"]).build();

      expect(sql).toContain(
        "JSONExtract(multiIf(simpleJSONHas(sheet_0_fields, 'soil'), simpleJSONExtractRaw(sheet_0_fields, 'soil'), NULL), 'Nullable(String)') AS `soil`",
      );
    });

    it("keeps a page of many wide sheets within the store's query size", () => {
      const wide = Array.from({ length: 20 }, (_, sheet) => {
        const fields = Array.from({ length: 32 }, (_, field) => `s${sheet}_field_${field}: DOUBLE`);
        return {
          id: `s${sheet}`,
          matchOn: "plot",
          schema: `OBJECT<${fields.join(", ")}>`,
          version: "1",
        };
      });
      const schema = `OBJECT<${wide.map(({ schema }) => schema.slice("OBJECT<".length, -1)).join(", ")}>`;

      const sql = measurements()
        .parseVariant("custom_metadata", schema, "metadata")
        .metadataSheets(wide)
        .orderBy({ column: "id", direction: "ASC" })
        .limit(20)
        .build();

      expect(Buffer.byteLength(sql)).toBeLessThan(1024 * 1024);
    });

    it("reads a payload, a reserved name or a sheet given after it first read the fields", () => {
      const builder = measurements().parseVariant(
        "questions_data",
        "OBJECT<plot: STRING>",
        "answer",
      );
      const names = () => builder.outputColumns().map(({ name }) => name);
      expect(names()).toContain("plot");

      builder.reserve(["plot"]);
      expect(names()).toContain("plot_answer");

      builder.parseVariant("custom_metadata", "OBJECT<soil: STRING>", "metadata");
      expect(names()).toContain("soil");
      expect(builder.build()).toContain(
        "JSONExtract(CAST(NULL AS Nullable(String)), 'Nullable(String)') AS `soil`",
      );

      builder.metadataSheets([
        { id: "s1", matchOn: "plot", schema: "OBJECT<soil: STRING>", version: "1" },
      ]);
      expect(builder.build()).toContain(
        "JSONExtract(multiIf(simpleJSONHas(sheet_0_fields, 'soil'), simpleJSONExtractRaw(sheet_0_fields, 'soil'), NULL), 'Nullable(String)') AS `soil`",
      );
    });

    it("compares a decimal field with a plain number as Spark does, as a decimal of its own scale", () => {
      const sql = withMetadata()
        .select(["id"])
        .filter({ column: "area", operator: "equals", value: 1.155 })
        .build();

      expect(sql).toContain("= toDecimal256('1.155', 3)");
    });

    it("looks for text in a decimal as its cell shows it, at its scale", () => {
      const sql = withMetadata()
        .select(["id"])
        .filter({ column: "area", operator: "contains", value: "5.00" })
        .build();

      expect(sql).toMatch(
        /toDecimalString\(accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\), 2\) LIKE '%5\.00%'/,
      );
    });

    it("compares a decimal field with text as two doubles, as Spark does", () => {
      const sql = withMetadata()
        .select(["id"])
        .filter({ column: "area", operator: "in", value: ["1.15"] })
        .build();

      expect(sql).toMatch(
        /toFloat64\(accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\)\) IN \(toFloat64OrNull\(/,
      );
    });

    it("compares a number listed with text as a double too, as the decimal field then reads", () => {
      const sql = withMetadata()
        .select(["id"])
        .filter({ column: "area", operator: "in", value: [1.15, "garbage"] })
        .build();

      expect(sql).toMatch(
        /toFloat64\(accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\)\) IN \(toFloat64\(1\.15\), toFloat64OrNull\(/,
      );
    });

    it("compares both bounds of a range with one text bound as doubles, and a plain range as decimals", () => {
      const range = (value: [string | number, string | number]) =>
        withMetadata()
          .select(["id"])
          .filter({ column: "area", operator: "between", value })
          .build();

      expect(range([1.15, "5"])).toMatch(
        /toFloat64\(accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\)\) BETWEEN toFloat64\(1\.15\) AND toFloat64OrNull\(/,
      );
      expect(range([1.15, 5])).toMatch(
        /accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\) BETWEEN toDecimal256\('1\.15', 2\) AND toDecimal256\('5', 0\)/,
      );
      expect(range(["1.15", "5"])).toMatch(
        /toFloat64\(accurateCastOrNull\(.+, 'Decimal\(4, 2\)'\)\) BETWEEN toFloat64OrNull\(.+\) AND toFloat64OrNull\(/,
      );
    });

    it("unquotes a text field, keeps a mix of kinds as its JSON, and reads null as none only where typed", () => {
      const mixedSchema = "OBJECT<mixed: VARIANT, soil: STRING, tags: ARRAY<STRING>>";
      const sql = measurements()
        .parseVariant("custom_metadata", mixedSchema, "metadata")
        .metadataSheets([{ id: "s1", matchOn: "plot", schema: mixedSchema, version: "1" }])
        .select(["soil", "mixed", "tags"])
        .build();

      expect(sql).toContain(
        "JSONExtract(multiIf(JSONHas(sheet_0_fields, 'soil'), JSONExtractRaw(sheet_0_fields, 'soil'), NULL), 'Nullable(String)') AS `soil`",
      );
      expect(sql).toContain(
        "multiIf(JSONHas(sheet_0_fields, 'mixed'), JSONExtractRaw(sheet_0_fields, 'mixed'), NULL) AS `mixed`",
      );
      expect(sql).toContain(
        "nullIf(multiIf(JSONHas(sheet_0_fields, 'tags'), JSONExtractRaw(sheet_0_fields, 'tags'), NULL), 'null') AS `tags`",
      );
    });

    it("joins each sheet a row can match, by an answer or the device, onto a sorted page's own rows", () => {
      const sql = withMetadata()
        .select(["id", "soil"])
        .orderBy({ column: "id", direction: "ASC" })
        .limit(10)
        .build();

      const lines = sql.split("\n");
      expect(lines.slice(1, 4)).toEqual([
        "FROM (SELECT base.*, sheet_0.fields AS sheet_0_fields, sheet_1.fields AS sheet_1_fields",
        "FROM (SELECT * FROM experiment_measurements(experiment = 'e1')",
        `WHERE (${key}) IN (SELECT ${key}`,
      ]);
      expect(lines[4]).toBe("FROM experiment_measurements(experiment = 'e1')");
      expect(sql).toContain(
        "LEFT JOIN (SELECT identifier, fields FROM experiment_metadata_rows(experiment = 'e1') WHERE sheet_id = 's1') AS sheet_0 ON sheet_0.identifier = base.questions_data['plot']",
      );
      expect(sql).toContain(
        "WHERE sheet_id = 's2') AS sheet_1 ON sheet_1.identifier = base.device_id",
      );
      expect(sql).not.toContain("'s3'");
    });

    it("joins the whole table's metadata to pick a page by a metadata field", () => {
      const sql = withMetadata()
        .select(["id"])
        .filter({ column: "soil", operator: "equals", value: "loam" })
        .orderBy({ column: "id", direction: "ASC" })
        .limit(10)
        .build();

      const page = sql.slice(sql.indexOf(`IN (SELECT ${key}`));
      expect(page).toMatch(/^IN \(SELECT [^\n]+\nFROM \(SELECT base\.\*, sheet_0\.fields/);
      expect(page).toContain(
        "FROM (SELECT * FROM experiment_measurements(experiment = 'e1')) AS base",
      );
    });

    it("joins nothing for a read that names no metadata, or a table whose rows take none", () => {
      const plain = withMetadata().select(["id"]).orderBy({ column: "id" }).limit(10).build();
      const upload = new StoreQueryBuilder()
        .read(UPLOADS_TABLE, "e1", "t1")
        .metadataSheets(sheets)
        .select(["custom_metadata"])
        .build();

      expect(plain).not.toContain("experiment_metadata_rows");
      expect(upload).toBe(
        "SELECT CAST(NULL AS Nullable(String)) AS `custom_metadata`\nFROM experiment_uploads(experiment = 'e1')\nWHERE upload_table_id = 't1'",
      );
    });
  });

  it("reads an unsorted page as one statement, which stops at its limit", () => {
    const sql = measurements().select(["id"]).limit(5).build();

    expect(sql).toBe(
      "SELECT toString(id) AS `id`\nFROM experiment_measurements(experiment = 'e1')\nLIMIT 5",
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
