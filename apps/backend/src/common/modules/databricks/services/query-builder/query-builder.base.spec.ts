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
      expect(query).toBe("SELECT * FROM t WHERE `name` = 'O''Connor'");
    });

    it("should group by columns", () => {
      const query = builder.from("t").groupBy(["c1", "c2"]).build();
      expect(query).toBe("SELECT * FROM t GROUP BY `c1`, `c2`");
    });

    it("should order by column", () => {
      const query = builder.from("t").orderBy("created_at", "DESC").build();
      expect(query).toBe("SELECT * FROM t ORDER BY `created_at` DESC");
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
  });

  describe("VariantQueryBuilder", () => {
    let builder: VariantQueryBuilder;

    beforeEach(() => {
      builder = new VariantQueryBuilder();
    });

    it("should transform schema for from_json", () => {
      const schema = "OBJECT<a: STRING, b: OBJECT<c: INT>>";
      const transformed = builder.transformSchemaForFromJson(schema);
      expect(transformed).toBe("STRUCT<a: STRING, b: STRUCT<c: INT>>");
    });

    it("should build variant query", () => {
      const query = builder
        .from("events")
        .select(["id", "ts"])
        .parseVariant("payload", "STRUCT<x:INT>", "data")
        .where("ts > 0")
        .orderBy("ts DESC")
        .limit(10)
        .build();

      expect(query).toContain(
        "SELECT id,\n    ts\n        FROM (\n          SELECT \n        * EXCEPT (payload, data),\n        data.*\n      FROM (\n        SELECT \n          *,\n          from_json(payload::string, 'STRUCT<x:INT>') as data",
      );
      expect(query).toContain("FROM events");
      expect(query).toContain("WHERE ts > 0");
      expect(query).toContain("ORDER BY `ts DESC` ASC");
      expect(query).toContain("LIMIT 10");
    });

    it("should throw if from missing", () => {
      expect(() => builder.build()).toThrow("FROM clause is required");
    });

    it("should throw if no variants", () => {
      builder.from("t");
      expect(() => builder.build()).toThrow("At least one VARIANT column is required");
    });

    it("should handle except columns", () => {
      const query = builder.from("t").parseVariant("v", "STRUCT<x:INT>").except(["secret"]).build();

      // checking logic for except clause generation
      expect(query).toContain("EXCEPT (v, parsed_v, secret)");
    });

    it("should handle offset in variant query", () => {
      const query = builder
        .from("t")
        .parseVariant("v", "STRUCT<x:INT>")
        .limit(5)
        .offset(10)
        .build();

      expect(query).toContain("LIMIT 5");
      expect(query).toContain("OFFSET 10");
    });
  });
});
