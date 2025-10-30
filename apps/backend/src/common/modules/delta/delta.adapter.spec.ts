import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import { DeltaAdapter } from "./delta.adapter";

describe("DeltaAdapter", () => {
  const testApp = TestHarness.App;
  const deltaEndpoint = process.env.DELTA_ENDPOINT || "https://delta.example.com";

  let deltaAdapter: DeltaAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    deltaAdapter = testApp.module.get(DeltaAdapter);
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listTables", () => {
    it("should successfully list tables for an experiment", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const shareName = "exp_test_experiment_exp-123";
      const schemaName = "default";

      const mockTablesResponse = {
        items: [
          {
            name: "sensor_data",
            schema: schemaName,
            share: shareName,
            shareId: "share-uuid",
            id: "table-uuid-1",
          },
          {
            name: "measurements",
            schema: schemaName,
            share: shareName,
            id: "table-uuid-2",
          },
        ],
      };

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables`)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.listTables(experimentName, experimentId);

      assertSuccess(result);
      expect(result.value.tables).toHaveLength(2);
      expect(result.value.tables[0].name).toBe("sensor_data");
      expect(result.value.tables[0].catalog_name).toBe(shareName);
      expect(result.value.tables[0].schema_name).toBe(schemaName);
      expect(result.value.tables[0].table_type).toBe("TABLE");
      expect(result.value.tables[1].name).toBe("measurements");
    });

    it("should handle experiment name with spaces", async () => {
      const experimentName = "My Test Experiment";
      const experimentId = "exp-456";
      const expectedShareName = "exp_my_test_experiment_exp-456";

      const mockTablesResponse = {
        items: [
          {
            name: "data_table",
            schema: "default",
            share: expectedShareName,
          },
        ],
      };

      nock(deltaEndpoint)
        .get(`/shares/${expectedShareName}/schemas/default/tables`)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.listTables(experimentName, experimentId);

      assertSuccess(result);
      expect(result.value.tables).toHaveLength(1);
    });

    it("should return empty tables list when share has no tables", async () => {
      const experimentName = "Empty Experiment";
      const experimentId = "exp-789";

      const mockTablesResponse = {
        items: [],
      };

      nock(deltaEndpoint)
        .get(/\/shares\/.*\/schemas\/.*\/tables/)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.listTables(experimentName, experimentId);

      assertSuccess(result);
      expect(result.value.tables).toHaveLength(0);
    });

    it("should handle errors when listing tables fails", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-999";

      nock(deltaEndpoint)
        .get(/\/shares\/.*\/schemas\/.*\/tables/)
        .reply(404, { errorCode: "SHARE_NOT_FOUND", message: "Share not found" });

      const result = await deltaAdapter.listTables(experimentName, experimentId);

      assertFailure(result);
    });
  });

  describe("getTableData", () => {
    it("should successfully get table data with pagination", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";
      const shareName = "exp_test_experiment_exp-123";
      const schemaName = "default";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\",\\"fields\\":[{\\"name\\":\\"id\\",\\"type\\":\\"integer\\",\\"nullable\\":false},{\\"name\\":\\"value\\",\\"type\\":\\"double\\",\\"nullable\\":true}]}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024,"stats":"{\\"numRecords\\":100}"}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {
          limitHint: 100,
        })
        .reply(200, ndjsonResponse, {
          "delta-table-version": "5",
        });

      // Mock the parquet file download
      nock("https://example.com").get("/file1.parquet").reply(200, Buffer.from([]));

      const result = await deltaAdapter.getTableData(
        experimentName,
        experimentId,
        tableName,
        1,
        100,
      );

      assertSuccess(result);
      expect(result.value.columns).toBeDefined();
      expect(result.value.rows).toBeDefined();
    });

    it("should use default pagination parameters", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";
      const shareName = "exp_test_experiment_exp-123";
      const schemaName = "default";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\",\\"fields\\":[]}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {
          limitHint: 100,
        })
        .reply(200, ndjsonResponse);

      const result = await deltaAdapter.getTableData(experimentName, experimentId, tableName);

      assertSuccess(result);
    });

    it("should handle errors when querying table fails", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "nonexistent_table";

      nock(deltaEndpoint)
        .post(/\/shares\/.*\/schemas\/.*\/tables\/.*\/query/)
        .reply(404, { errorCode: "TABLE_NOT_FOUND", message: "Table not found" });

      const result = await deltaAdapter.getTableData(experimentName, experimentId, tableName);

      assertFailure(result);
    });
  });

  describe("getTableColumns", () => {
    it("should successfully get specific columns from table", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";
      const columns = ["id", "value"];
      const shareName = "exp_test_experiment_exp-123";
      const schemaName = "default";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\",\\"fields\\":[{\\"name\\":\\"id\\",\\"type\\":\\"integer\\",\\"nullable\\":false},{\\"name\\":\\"value\\",\\"type\\":\\"double\\",\\"nullable\\":true},{\\"name\\":\\"timestamp\\",\\"type\\":\\"string\\",\\"nullable\\":true}]}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {})
        .reply(200, ndjsonResponse);

      const result = await deltaAdapter.getTableColumns(
        experimentName,
        experimentId,
        tableName,
        columns,
      );

      assertSuccess(result);
      expect(result.value.columns).toBeDefined();
      // Columns should be filtered to only include requested ones
      const columnNames = result.value.columns.map((col) => col.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("value");
      expect(columnNames).not.toContain("timestamp");
    });

    it("should handle errors when getting columns fails", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";
      const columns = ["id"];

      nock(deltaEndpoint)
        .post(/\/shares\/.*\/schemas\/.*\/tables\/.*\/query/)
        .reply(500, { error: "Internal server error" });

      const result = await deltaAdapter.getTableColumns(
        experimentName,
        experimentId,
        tableName,
        columns,
      );

      assertFailure(result);
    });
  });

  describe("getTableRowCount", () => {
    it("should successfully get row count from file stats", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";
      const shareName = "exp_test_experiment_exp-123";
      const schemaName = "default";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024,"stats":"{\\"numRecords\\":100}"}}
{"file":{"url":"https://example.com/file2.parquet","id":"file2","partitionValues":{},"size":2048,"stats":"{\\"numRecords\\":150}"}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {})
        .reply(200, ndjsonResponse);

      const result = await deltaAdapter.getTableRowCount(experimentName, experimentId, tableName);

      assertSuccess(result);
      expect(result.value).toBe(250); // 100 + 150
    });

    it("should return 0 when no files have stats", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024}}`;

      nock(deltaEndpoint)
        .post(/\/shares\/.*\/schemas\/.*\/tables\/.*\/query/)
        .reply(200, ndjsonResponse);

      const result = await deltaAdapter.getTableRowCount(experimentName, experimentId, tableName);

      assertSuccess(result);
      expect(result.value).toBe(0);
    });

    it("should handle malformed stats gracefully", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024,"stats":"invalid json"}}
{"file":{"url":"https://example.com/file2.parquet","id":"file2","partitionValues":{},"size":2048,"stats":"{\\"numRecords\\":50}"}}`;

      nock(deltaEndpoint)
        .post(/\/shares\/.*\/schemas\/.*\/tables\/.*\/query/)
        .reply(200, ndjsonResponse);

      const result = await deltaAdapter.getTableRowCount(experimentName, experimentId, tableName);

      assertSuccess(result);
      expect(result.value).toBe(50); // Only count the valid one
    });

    it("should handle errors when querying fails", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";

      nock(deltaEndpoint)
        .post(/\/shares\/.*\/schemas\/.*\/tables\/.*\/query/)
        .reply(500, { error: "Internal server error" });

      const result = await deltaAdapter.getTableRowCount(experimentName, experimentId, tableName);

      assertFailure(result);
    });
  });

  describe("tableExists", () => {
    it("should return true when table exists", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";

      const mockTablesResponse = {
        items: [
          {
            name: "sensor_data",
            schema: "default",
            share: "exp_test_experiment_exp-123",
          },
          {
            name: "other_table",
            schema: "default",
            share: "exp_test_experiment_exp-123",
          },
        ],
      };

      nock(deltaEndpoint)
        .get(/\/shares\/.*\/schemas\/.*\/tables/)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.tableExists(experimentName, experimentId, tableName);

      assertSuccess(result);
      expect(result.value).toBe(true);
    });

    it("should return false when table does not exist", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "nonexistent_table";

      const mockTablesResponse = {
        items: [
          {
            name: "sensor_data",
            schema: "default",
            share: "exp_test_experiment_exp-123",
          },
        ],
      };

      nock(deltaEndpoint)
        .get(/\/shares\/.*\/schemas\/.*\/tables/)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.tableExists(experimentName, experimentId, tableName);

      assertSuccess(result);
      expect(result.value).toBe(false);
    });

    it("should handle errors when listing tables fails", async () => {
      const experimentName = "Test Experiment";
      const experimentId = "exp-123";
      const tableName = "sensor_data";

      nock(deltaEndpoint)
        .get(/\/shares\/.*\/schemas\/.*\/tables/)
        .reply(403, { error: "Forbidden" });

      const result = await deltaAdapter.tableExists(experimentName, experimentId, tableName);

      assertFailure(result);
    });
  });

  describe("buildShareSchema", () => {
    it("should correctly build share name from experiment info", async () => {
      const experimentName = "PhotoPhys Experiment";
      const experimentId = "exp-abc-123";
      const expectedShareName = "exp_photophys_experiment_exp-abc-123";

      // Test indirectly through listTables
      const mockTablesResponse = {
        items: [],
      };

      nock(deltaEndpoint)
        .get(`/shares/${expectedShareName}/schemas/default/tables`)
        .reply(200, mockTablesResponse);

      const result = await deltaAdapter.listTables(experimentName, experimentId);

      assertSuccess(result);
    });
  });
});
