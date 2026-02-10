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

    it("should build query with EXCEPT clause for non-variant queries", () => {
      const sql = service.buildQuery({
        table: "open_jii_dev.centrum.experiment_device_data",
        exceptColumns: ["experiment_id", "raw_data"],
        whereConditions: [["experiment_id", "d89a6dce-540c-4ac2-8b8c-516afc2bd525"]],
        orderBy: "processed_timestamp",
        orderDirection: "DESC",
        limit: 10,
        offset: 0,
      });

      expect(sql).toBe(
        "SELECT * EXCEPT (`experiment_id`, `raw_data`) FROM open_jii_dev.centrum.experiment_device_data WHERE `experiment_id` = 'd89a6dce-540c-4ac2-8b8c-516afc2bd525' ORDER BY `processed_timestamp` DESC LIMIT 10 OFFSET 0",
      );
    });

    it("should build query with EXCEPT and specific columns", () => {
      const sql = service.buildQuery({
        table: "my_table",
        columns: ["id", "name", "email"],
        exceptColumns: ["internal_id"],
        limit: 5,
      });

      expect(sql).toBe("SELECT `id`, `name`, `email` EXCEPT (`internal_id`) FROM my_table LIMIT 5");
    });

    it("should build variant query when variants are present", () => {
      const sql = service.buildQuery({
        table: "events",
        variants: [{ columnName: "data", schema: "OBJECT<id:INT>" }],
      });

      expect(sql).toContain("from_json(data::string");
      expect(sql).toContain("STRUCT<id:INT>");
    });

    it("should build variant query with exceptColumns", () => {
      const sql = service.buildQuery({
        table: "events",
        columns: ["id", "timestamp"],
        variants: [{ columnName: "payload", schema: "OBJECT<msg:STRING>" }],
        exceptColumns: ["raw_id", "internal_flag"],
      });

      expect(sql).toContain("from_json(payload::string");
      expect(sql).toContain("STRUCT<msg:STRING>");
      expect(sql).toContain("EXCEPT (payload, parsed_payload, raw_id, internal_flag)");
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
