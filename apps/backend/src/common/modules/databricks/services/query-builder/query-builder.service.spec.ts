import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import { QueryBuilderService } from "./query-builder.service";

describe("QueryBuilderService", () => {
  let service: QueryBuilderService;

  beforeEach(() => {
    service = new QueryBuilderService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("query() should return SqlQueryBuilder", () => {
    expect(service.query()).toBeInstanceOf(SqlQueryBuilder);
  });

  it("variantQuery() should return VariantQueryBuilder", () => {
    expect(service.variantQuery()).toBeInstanceOf(VariantQueryBuilder);
  });

  describe("buildQuery", () => {
    it("should build simple select query", () => {
      const sql = service.buildQuery({
        table: "users",
        columns: ["id", "name"],
        whereConditions: [["status", "active"]],
        limit: 5,
      });

      expect(sql).toBe("SELECT `id`, `name` FROM users WHERE `status` = 'active' LIMIT 5");
    });

    it("should build variant query when variants are present", () => {
      const sql = service.buildQuery({
        table: "events",
        variants: [{ columnName: "data", schema: "OBJECT<id:INT>" }],
      });

      expect(sql).toContain("from_json(data::string");
      expect(sql).toContain("STRUCT<id:INT>");
    });
  });

  describe("buildCountQuery", () => {
    it("should build count query", () => {
      const sql = service.buildCountQuery({
        table: "logs",
        whereClause: "level = 'ERROR'",
      });
      expect(sql).toBe("SELECT COUNT(*) FROM logs WHERE level = 'ERROR'");
    });
  });
});
