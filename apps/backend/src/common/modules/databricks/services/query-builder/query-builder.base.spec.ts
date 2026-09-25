import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";

describe("QueryBuilder Base", () => {
  describe("SqlQueryBuilder", () => {
    let builder: SqlQueryBuilder;

    beforeEach(() => {
      builder = new SqlQueryBuilder();
    });

    it("should build simple select * from table", () => {
      const query = builder.from("my_table").build();
      expect(query).toBe("SELECT * FROM my_table");
    });

    it("should build select specific columns", () => {
      const query = builder.select(["col1", "col2"]).from("my_table").build();
      expect(query).toBe("SELECT `col1`, `col2` FROM my_table");
    });

    it("should escape identifiers", () => {
      const query = builder.select(["select", "from"]).from("table`name").build();
      expect(query).toBe("SELECT `select`, `from` FROM table`name");
    });

    it("should add where conditions", () => {
      const query = builder.from("t").where("id > 5").whereEquals("status", "active").build();
      expect(query).toBe("SELECT * FROM t WHERE id > 5 AND `status` = 'active'");
    });

    it("should escape values in whereEquals", () => {
      const query = builder.from("t").whereEquals("name", "O'Connor").build();
      expect(query).toBe("SELECT * FROM t WHERE `name` = 'O\\'Connor'");
    });

    it("should keep a backslash-quote value inside its literal", () => {
      const query = builder.from("t").whereEquals("name", "\\' OR 1=1 --").build();
      expect(query).toBe("SELECT * FROM t WHERE `name` = '\\\\\\' OR 1=1 --'");
    });

    it("should group by columns", () => {
      const query = builder.from("t").groupBy(["c1", "c2"]).build();
      expect(query).toBe("SELECT * FROM t GROUP BY `c1`, `c2`");
    });

    it("should order by column", () => {
      const query = builder.from("t").orderBy("created_at", "DESC").build();
      expect(query).toBe("SELECT * FROM t ORDER BY `created_at` DESC");
    });

    it("should order by nested struct field", () => {
      const query = builder.from("t").orderBy("contributor.name", "ASC").build();
      expect(query).toBe("SELECT * FROM t ORDER BY `contributor`.`name` ASC");
    });

    it("should order by deeply nested struct field", () => {
      const query = builder.from("t").orderBy("user.profile.name", "DESC").build();
      expect(query).toBe("SELECT * FROM t ORDER BY `user`.`profile`.`name` DESC");
    });

    it("should allow disabling case-insensitive sorting", () => {
      const query = builder.from("t").orderBy("created_at", "ASC").build();
      expect(query).toBe("SELECT * FROM t ORDER BY `created_at` ASC");
    });

    it("should add limit and offset", () => {
      const query = builder.from("t").limit(10).offset(5).build();
      expect(query).toBe("SELECT * FROM t LIMIT 10 OFFSET 5");
    });

    it("should throw error if from is missing", () => {
      expect(() => builder.build()).toThrow("FROM clause is required");
    });

    it("should support selectRaw", () => {
      const query = builder.from("t").selectRaw("COUNT(*) as cnt").build();
      expect(query).toBe("SELECT COUNT(*) as cnt FROM t");
    });

    it("should support except clause with SELECT *", () => {
      const query = builder.from("t").except(["col1", "col2"]).build();
      expect(query).toBe("SELECT * EXCEPT (`col1`, `col2`) FROM t");
    });

    it("drops EXCEPT when explicit columns are projected (Databricks rejects the combo)", () => {
      // Databricks/Spark only allows `EXCEPT (...)` after `SELECT *`; with
      // an explicit column list the un-listed columns are already excluded
      // and `EXCEPT` raises PARSE_SYNTAX_ERROR. The builder silently drops
      // `EXCEPT` in that case so the SQL stays valid.
      const query = builder.select(["a", "b", "c"]).from("t").except(["secret"]).build();
      expect(query).toBe("SELECT `a`, `b`, `c` FROM t");
    });

    it("should escape identifiers in except clause", () => {
      // Dotted identifiers are split per segment so struct-field paths
      // (e.g. `contributor.id`) escape correctly; `escapeIdentifier`
      // splits on `.` and backticks each part independently.
      const query = builder.from("t").except(["user.id", "select"]).build();
      expect(query).toBe("SELECT * EXCEPT (`user`.`id`, `select`) FROM t");
    });

    it("should work with except and other clauses", () => {
      const query = builder
        .from("users")
        .except(["password", "token"])
        .where("active = true")
        .orderBy("created_at", "DESC")
        .limit(10)
        .build();
      expect(query).toBe(
        "SELECT * EXCEPT (`password`, `token`) FROM users WHERE active = true ORDER BY `created_at` DESC LIMIT 10",
      );
    });
  });

  describe("VariantQueryBuilder", () => {
    let builder: VariantQueryBuilder;

    beforeEach(() => {
      builder = new VariantQueryBuilder();
    });

    it("turns object types into struct cast targets", () => {
      expect(builder.variantCastType("OBJECT<a: STRING, b: OBJECT<c: INT>>")).toBe(
        "STRUCT<a: STRING, b: STRUCT<c: INT>>",
      );
    });

    it("reads VOID fields, nested or whole, as STRING", () => {
      expect(builder.variantCastType("ARRAY<OBJECT<text: STRING, dead: VOID>>")).toBe(
        "ARRAY<STRUCT<text: STRING, dead: STRING>>",
      );
      expect(builder.variantCastType("VOID")).toBe("STRING");
      expect(builder.variantCastType("ARRAY<VOID>")).toBe("ARRAY<STRING>");
      expect(builder.variantCastType("OBJECT<VOID: INT, e: ARRAY<VOID>>")).toBe(
        "STRUCT<VOID: INT, e: ARRAY<STRING>>",
      );
    });

    it("flattens every field by typed path in one SELECT", () => {
      const query = builder
        .from("events")
        .parseVariant("payload", "OBJECT<phi2: DECIMAL(3,3), trace: ARRAY<OBJECT<v: DOUBLE>>>")
        .where("`experiment_id` = 'e-1'")
        .build();

      expect(query).toBe(
        [
          "SELECT * EXCEPT (`payload`), " +
            "try_variant_get(`payload`, '$[\"phi2\"]', 'DECIMAL(3,3)') AS `phi2`, " +
            "try_variant_get(`payload`, '$[\"trace\"]', 'ARRAY<STRUCT<v: DOUBLE>>') AS `trace`",
          "FROM events",
          "WHERE `experiment_id` = 'e-1'",
        ].join("\n"),
      );
      expect(query).not.toContain("from_json");
    });

    it("projects chosen fields as expressions and base columns as identifiers", () => {
      const query = builder
        .from("events")
        .parseVariant("payload", "OBJECT<`Ambient Temperature`: DOUBLE>")
        .select(["select", "Ambient Temperature"])
        .build();

      expect(query).toContain(
        "SELECT `select`, try_variant_get(`payload`, '$[\"Ambient Temperature\"]', 'DOUBLE') AS `Ambient Temperature`",
      );
    });

    it("filters a flattened field by its expression in the same WHERE as base filters", () => {
      const query = builder
        .from("events")
        .parseVariant("payload", "OBJECT<phi2: DOUBLE>")
        .filter({ column: "phi2", operator: "greater_than", value: 0.5 })
        .filter({ column: "device_name", operator: "equals", value: "d-1" })
        .build();

      expect(query).toContain(
        "WHERE try_variant_get(`payload`, '$[\"phi2\"]', 'DOUBLE') > 0.5 AND `device_name` = 'd-1'",
      );
      expect(query.match(/WHERE/g)).toHaveLength(1);
    });

    it("orders by the output name of a projected field and by the expression otherwise", () => {
      const projected = new VariantQueryBuilder()
        .from("t")
        .parseVariant("v", "OBJECT<x: INT>")
        .select(["x"])
        .distinct()
        .orderBy("x", "DESC")
        .build();
      const unprojected = new VariantQueryBuilder()
        .from("t")
        .parseVariant("v", "OBJECT<x: INT>")
        .select(["id"])
        .orderBy("x")
        .build();

      expect(projected).toContain("ORDER BY `x` DESC");
      expect(unprojected).toContain("ORDER BY try_variant_get(`v`, '$[\"x\"]', 'INT') ASC");
    });

    it("quotes awkward field names in the path and keeps dotted names one identifier", () => {
      const query = builder
        .from("t")
        .parseVariant("v", "OBJECT<`it's`: INT, `a\"b`: INT, `c'd\"e`: INT, `dot.ted`: INT>")
        .build();

      expect(query).toContain("try_variant_get(`v`, '$[\"it\\'s\"]', 'INT') AS `it's`");
      expect(query).toContain("try_variant_get(`v`, '$[\\'a\"b\\']', 'INT') AS `a\"b`");
      expect(query).toContain(
        "try_cast(element_at(try_cast(`v` AS MAP<STRING, VARIANT>), 'c\\'d\"e') AS INT) AS `c'd\"e`",
      );
      expect(query).toContain("AS `dot.ted`");
    });

    it("reads a VARIANT whose schema is no object whole, under its own name", () => {
      const query = builder.from("t").parseVariant("v", "ARRAY<OBJECT<x: DOUBLE>>").build();

      expect(query).toContain(
        "SELECT * EXCEPT (`v`), try_variant_get(`v`, '$', 'ARRAY<STRUCT<x: DOUBLE>>') AS `v`",
      );
    });

    it("projects a field in two VARIANT columns once, from the first", () => {
      const query = builder
        .from("t")
        .parseVariant("a", "OBJECT<time: STRING, x: INT>")
        .parseVariant("b", "OBJECT<time: STRING, y: INT>")
        .orderBy("time")
        .build();

      expect(query).toContain(
        "SELECT * EXCEPT (`a`, `b`), " +
          "try_variant_get(`a`, '$[\"time\"]', 'STRING') AS `time`, " +
          "try_variant_get(`a`, '$[\"x\"]', 'INT') AS `x`, " +
          "try_variant_get(`b`, '$[\"y\"]', 'INT') AS `y`",
      );
      expect(query.match(/AS `time`/g)).toHaveLength(1);
      expect(query).toContain("ORDER BY `time` ASC");
    });

    it("contributes no columns for an empty object schema", () => {
      const query = builder.from("t").parseVariant("v", "OBJECT<>").build();

      expect(query).toBe("SELECT * EXCEPT (`v`)\nFROM t");
    });

    it("excludes the raw VARIANT and the requested columns", () => {
      const query = builder
        .from("t")
        .parseVariant("v", "OBJECT<x: INT>")
        .except(["secret"])
        .build();

      expect(query).toContain("SELECT * EXCEPT (`v`, `secret`)");
    });

    it("applies limit and offset", () => {
      const query = builder
        .from("t")
        .parseVariant("v", "OBJECT<x: INT>")
        .limit(5)
        .offset(10)
        .build();

      expect(query).toContain("LIMIT 5\nOFFSET 10");
    });

    it("should throw if from missing", () => {
      expect(() => builder.build()).toThrow("FROM clause is required");
    });

    it("should throw if no variants", () => {
      builder.from("t");
      expect(() => builder.build()).toThrow("At least one VARIANT column is required");
    });
  });
});
