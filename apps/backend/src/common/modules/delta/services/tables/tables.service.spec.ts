import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import type { TableMetadataResponse, TableQueryResponse } from "../shares/shares.types";
import { DeltaTablesService } from "./tables.service";

describe("DeltaTablesService", () => {
  const testApp = TestHarness.App;
  const deltaEndpoint = process.env.DELTA_ENDPOINT || "https://delta.example.com";

  let tablesService: DeltaTablesService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    tablesService = testApp.module.get(DeltaTablesService);
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getTableMetadata", () => {
    it("should successfully get table metadata", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\"}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`)
        .reply(200, ndjsonResponse, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "delta-table-version": "5",
        });

      const result = await tablesService.getTableMetadata(shareName, schemaName, tableName);

      assertSuccess(result);
      expect(result.value.protocol.minReaderVersion).toBe(1);
      expect(result.value.metadata.id).toBe("table-uuid");
      expect(result.value.metadata.format.provider).toBe("parquet");
      expect(result.value.version).toBe(5);
    });

    it("should handle missing delta-table-version header", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`)
        .reply(200, ndjsonResponse, {
          "content-type": "application/x-ndjson; charset=utf-8",
        });

      const result = await tablesService.getTableMetadata(shareName, schemaName, tableName);

      assertSuccess(result);
      expect(result.value.version).toBe(0);
    });

    it("should handle name encoding", async () => {
      const shareName = "share name";
      const schemaName = "schema name";
      const tableName = "table name";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .get("/shares/share%20name/schemas/schema%20name/tables/table%20name/metadata")
        .reply(200, ndjsonResponse);

      const result = await tablesService.getTableMetadata(shareName, schemaName, tableName);

      assertSuccess(result);
      expect(result.value.metadata.id).toBe("table-uuid");
    });

    it("should handle errors when getting table metadata fails", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "nonexistent_table";

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`)
        .reply(404, { errorCode: "TABLE_NOT_FOUND", message: "Table not found" });

      const result = await tablesService.getTableMetadata(shareName, schemaName, tableName);

      assertFailure(result);
      expect(result.error.message).toContain(
        `Failed to get table metadata for ${shareName}.${schemaName}.${tableName}`,
      );
    });

    it("should handle invalid NDJSON response", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const invalidResponse = `{"protocol":{"minReaderVersion":1}}`; // Missing metadata line

      nock(deltaEndpoint)
        .get(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`)
        .reply(200, invalidResponse);

      const result = await tablesService.getTableMetadata(shareName, schemaName, tableName);

      assertFailure(result);
      expect(result.error.message).toContain("Invalid metadata response");
    });
  });

  describe("queryTable", () => {
    it("should successfully query table with default parameters", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024}}
{"file":{"url":"https://example.com/file2.parquet","id":"file2","partitionValues":{},"size":2048}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {})
        .reply(200, ndjsonResponse, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "delta-table-version": "10",
        });

      const result = await tablesService.queryTable(shareName, schemaName, tableName);

      assertSuccess(result);
      expect(result.value.protocol.minReaderVersion).toBe(1);
      expect(result.value.metadata.id).toBe("table-uuid");
      expect(result.value.files).toHaveLength(2);
      expect(result.value.files[0].url).toBe("https://example.com/file1.parquet");
      expect(result.value.files[0].size).toBe(1024);
      expect(result.value.files[1].size).toBe(2048);
      expect(result.value.version).toBe(10);
    });

    it("should query table with limitHint parameter", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {
          limitHint: 100,
        })
        .reply(200, ndjsonResponse, {
          "delta-table-version": "5",
        });

      const result = await tablesService.queryTable(shareName, schemaName, tableName, {
        limitHint: 100,
      });

      assertSuccess(result);
      expect(result.value.files).toHaveLength(1);
    });

    it("should query table with version parameter", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {
          version: 3,
        })
        .reply(200, ndjsonResponse, {
          "delta-table-version": "3",
        });

      const result = await tablesService.queryTable(shareName, schemaName, tableName, {
        version: 3,
      });

      assertSuccess(result);
      expect(result.value.version).toBe(3);
    });

    it("should query table with predicateHints", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}
{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {
          predicateHints: ["col1 > 100", "col2 = 'value'"],
        })
        .reply(200, ndjsonResponse);

      const result = await tablesService.queryTable(shareName, schemaName, tableName, {
        predicateHints: ["col1 > 100", "col2 = 'value'"],
      });

      assertSuccess(result);
      expect(result.value.files).toHaveLength(1);
    });

    it("should handle query response with no files", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`, {})
        .reply(200, ndjsonResponse);

      const result = await tablesService.queryTable(shareName, schemaName, tableName);

      assertSuccess(result);
      expect(result.value.files).toHaveLength(0);
    });

    it("should handle errors when querying table fails", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(403, { errorCode: "FORBIDDEN", message: "Access denied" });

      const result = await tablesService.queryTable(shareName, schemaName, tableName);

      assertFailure(result);
      expect(result.error.message).toContain(
        `Failed to query table ${shareName}.${schemaName}.${tableName}`,
      );
    });

    it("should handle invalid NDJSON query response", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const invalidResponse = `{"file":{"url":"https://example.com/file1.parquet","id":"file1","partitionValues":{},"size":1024}}`; // Missing protocol and metadata

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(200, invalidResponse);

      const result = await tablesService.queryTable(shareName, schemaName, tableName);

      assertFailure(result);
      expect(result.error.message).toContain("Invalid query response");
    });
  });

  describe("authorization and headers", () => {
    it("should include correct headers in metadata request", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      const scope = nock(deltaEndpoint, {
        reqheaders: {
          authorization: (val) => val.startsWith("Bearer "),
          accept: "application/x-ndjson; charset=utf-8",
        },
      })
        .get(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/metadata`)
        .reply(200, ndjsonResponse);

      await tablesService.getTableMetadata(shareName, schemaName, tableName);

      expect(scope.isDone()).toBe(true);
    });

    it("should include correct headers in query request", async () => {
      const shareName = "test_share";
      const schemaName = "test_schema";
      const tableName = "test_table";

      const ndjsonResponse = `{"protocol":{"minReaderVersion":1}}
{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{}","partitionColumns":[]}}`;

      const scope = nock(deltaEndpoint, {
        reqheaders: {
          authorization: (val) => val.startsWith("Bearer "),
          "content-type": "application/json",
          accept: "application/x-ndjson; charset=utf-8",
        },
      })
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(200, ndjsonResponse);

      await tablesService.queryTable(shareName, schemaName, tableName);

      expect(scope.isDone()).toBe(true);
    });
  });
});
