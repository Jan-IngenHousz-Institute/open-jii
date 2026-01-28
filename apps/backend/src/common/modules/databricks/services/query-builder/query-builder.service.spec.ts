import { QueryBuilderService } from "./query-builder.service";

describe("QueryBuilderService", () => {
  let service: QueryBuilderService;

  beforeEach(() => {
    service = new QueryBuilderService();
  });

  describe("escapeIdentifier", () => {
    it("should wrap identifier in backticks", () => {
      expect(service.escapeIdentifier("column_name")).toBe("`column_name`");
    });

    it("should escape backticks in identifier", () => {
      expect(service.escapeIdentifier("column`name")).toBe("`column``name`");
    });
  });

  describe("escapeValue", () => {
    it("should wrap value in single quotes", () => {
      expect(service.escapeValue("test")).toBe("'test'");
    });

    it("should escape single quotes in value", () => {
      expect(service.escapeValue("test'value")).toBe("'test''value'");
    });
  });

  describe("query builder", () => {
    it("should build basic SELECT query", () => {
      const query = service.query().select(["id", "name"]).from("users").build();

      expect(query).toBe("SELECT `id`, `name` FROM users");
    });

    it("should build SELECT * query", () => {
      const query = service.query().from("users").build();

      expect(query).toBe("SELECT * FROM users");
    });

    it("should build query with WHERE clause", () => {
      const query = service.query().from("users").whereEquals("id", "123").build();

      expect(query).toBe("SELECT * FROM users WHERE `id` = '123'");
    });

    it("should build query with multiple WHERE conditions", () => {
      const query = service
        .query()
        .from("users")
        .whereEquals("id", "123")
        .whereEquals("status", "active")
        .build();

      expect(query).toBe("SELECT * FROM users WHERE `id` = '123' AND `status` = 'active'");
    });

    it("should build query with ORDER BY", () => {
      const query = service.query().from("users").orderBy("name", "DESC").build();

      expect(query).toBe("SELECT * FROM users ORDER BY `name` DESC");
    });

    it("should build query with LIMIT and OFFSET", () => {
      const query = service.query().from("users").limit(10).offset(20).build();

      expect(query).toBe("SELECT * FROM users LIMIT 10 OFFSET 20");
    });

    it("should build complex query", () => {
      const query = service
        .query()
        .select(["id", "name", "email"])
        .from("users")
        .whereEquals("status", "active")
        .orderBy("name", "ASC")
        .limit(10)
        .offset(0)
        .build();

      expect(query).toBe(
        "SELECT `id`, `name`, `email` FROM users WHERE `status` = 'active' ORDER BY `name` ASC LIMIT 10 OFFSET 0",
      );
    });

    it("should throw error if FROM clause is missing", () => {
      expect(() => service.query().build()).toThrow("FROM clause is required");
    });
  });

  describe("variantQuery builder", () => {
    const mockSchema = "OBJECT<phi2: DOUBLE, messages: OBJECT<text: STRING>>";

    it("should build VARIANT parse query with SELECT *", () => {
      const query = service
        .variantQuery()
        .from("catalog.schema.table")
        .parseVariant("data", mockSchema)
        .build();

      expect(query).toContain("SELECT");
      expect(query).toContain("* EXCEPT (data, parsed_output)");
      expect(query).toContain("parsed_output.*");
      expect(query).toContain("from_json(data::string,");
      expect(query).toContain("STRUCT<phi2: DOUBLE, messages: STRUCT<text: STRING>>");
    });

    it("should build VARIANT parse query with specific columns", () => {
      const query = service
        .variantQuery()
        .from("catalog.schema.table")
        .select(["id", "timestamp"])
        .parseVariant("data", mockSchema)
        .build();

      expect(query).toContain("id,");
      expect(query).toContain("timestamp");
      expect(query).toContain("parsed_output.*");
    });

    it("should build VARIANT parse query with WHERE clause", () => {
      const query = service
        .variantQuery()
        .from("catalog.schema.table")
        .parseVariant("data", mockSchema)
        .where("id = '123'")
        .build();

      expect(query).toContain("WHERE id = '123'");
    });

    it("should build VARIANT parse query with ORDER BY", () => {
      const query = service
        .variantQuery()
        .from("catalog.schema.table")
        .parseVariant("data", mockSchema)
        .orderBy("timestamp DESC")
        .build();

      expect(query).toContain("ORDER BY timestamp DESC");
    });

    it("should build VARIANT parse query with LIMIT and OFFSET", () => {
      const query = service
        .variantQuery()
        .from("catalog.schema.table")
        .parseVariant("data", mockSchema)
        .limit(10)
        .offset(20)
        .build();

      expect(query).toContain("LIMIT 10");
      expect(query).toContain("OFFSET 20");
    });

    it("should throw error if FROM clause is missing", () => {
      expect(() => service.variantQuery().parseVariant("data", mockSchema).build()).toThrow(
        "FROM clause is required",
      );
    });

    it("should throw error if VARIANT column is missing", () => {
      expect(() => service.variantQuery().from("table").build()).toThrow(
        "VARIANT column and schema are required",
      );
    });
  });

  describe("buildSelectQuery (legacy)", () => {
    it("should build basic SELECT query", () => {
      const query = service.buildSelectQuery({
        table: "users",
        columns: ["id", "name"],
      });

      expect(query).toBe("SELECT `id`, `name` FROM users");
    });

    it("should build query with WHERE conditions", () => {
      const query = service.buildSelectQuery({
        table: "users",
        whereConditions: [
          ["id", "123"],
          ["status", "active"],
        ],
      });

      expect(query).toBe("SELECT * FROM users WHERE `id` = '123' AND `status` = 'active'");
    });

    it("should build query with ORDER BY", () => {
      const query = service.buildSelectQuery({
        table: "users",
        orderBy: "name",
        orderDirection: "DESC",
      });

      expect(query).toBe("SELECT * FROM users ORDER BY `name` DESC");
    });

    it("should build query with LIMIT and OFFSET", () => {
      const query = service.buildSelectQuery({
        table: "users",
        limit: 10,
        offset: 20,
      });

      expect(query).toBe("SELECT * FROM users LIMIT 10 OFFSET 20");
    });
  });

  describe("buildCountQuery (legacy)", () => {
    it("should build basic COUNT query", () => {
      const query = service.buildCountQuery({
        table: "users",
      });

      expect(query).toBe("SELECT COUNT(*) FROM users");
    });

    it("should build COUNT query with WHERE conditions", () => {
      const query = service.buildCountQuery({
        table: "users",
        whereConditions: [["status", "active"]],
      });

      expect(query).toBe("SELECT COUNT(*) FROM users WHERE `status` = 'active'");
    });
  });

  describe("buildWhereClause", () => {
    it("should build WHERE clause with single condition", () => {
      const clause = service.buildWhereClause([["id", "123"]]);

      expect(clause).toBe("`id` = '123'");
    });

    it("should build WHERE clause with multiple conditions", () => {
      const clause = service.buildWhereClause([
        ["id", "123"],
        ["status", "active"],
      ]);

      expect(clause).toBe("`id` = '123' AND `status` = 'active'");
    });
  });

  describe("transformSchemaForFromJson", () => {
    it("should replace OBJECT with STRUCT", () => {
      const schema = "OBJECT<phi2: DOUBLE, messages: OBJECT<text: STRING>>";
      const transformed = service.transformSchemaForFromJson(schema);

      expect(transformed).toBe("STRUCT<phi2: DOUBLE, messages: STRUCT<text: STRING>>");
    });

    it("should handle empty schema", () => {
      const transformed = service.transformSchemaForFromJson("");

      expect(transformed).toBe("");
    });
  });

  describe("buildVariantParseQuery (legacy)", () => {
    it("should build VARIANT parse query", () => {
      const query = service.buildVariantParseQuery({
        table: "catalog.schema.table",
        selectColumns: ["*"],
        variantColumn: "data",
        variantSchema: "OBJECT<phi2: DOUBLE>",
      });

      expect(query).toContain("* EXCEPT (data, parsed_output)");
      expect(query).toContain("parsed_output.*");
      expect(query).toContain("from_json(data::string,");
      expect(query).toContain("STRUCT<phi2: DOUBLE>");
    });

    it("should build VARIANT parse query with specific columns", () => {
      const query = service.buildVariantParseQuery({
        table: "catalog.schema.table",
        selectColumns: ["id", "timestamp"],
        variantColumn: "data",
        variantSchema: "OBJECT<phi2: DOUBLE>",
        whereClause: "id = '123'",
        orderBy: "timestamp DESC",
        limit: 10,
        offset: 0,
      });

      expect(query).toContain("id,");
      expect(query).toContain("timestamp");
      expect(query).toContain("WHERE id = '123'");
      expect(query).toContain("ORDER BY timestamp DESC");
      expect(query).toContain("LIMIT 10");
      expect(query).toContain("OFFSET 0");
    });
  });
});
