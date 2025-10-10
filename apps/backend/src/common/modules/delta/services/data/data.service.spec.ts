import * as Arrow from "apache-arrow";
import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import type { DeltaFile, DeltaMetadata } from "../shares/shares.types";
import { DeltaDataService } from "./data.service";

describe("DeltaDataService", () => {
  const testApp = TestHarness.App;

  let dataService: DeltaDataService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    dataService = testApp.module.get(DeltaDataService);

    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("processFiles", () => {
    const mockMetadata: DeltaMetadata = {
      id: "test-metadata-id",
      format: {
        provider: "parquet",
      },
      schemaString: JSON.stringify({
        type: "struct",
        fields: [
          {
            name: "id",
            type: "long",
            nullable: false,
            metadata: {},
          },
          {
            name: "name",
            type: "string",
            nullable: true,
            metadata: {},
          },
          {
            name: "created_at",
            type: "timestamp",
            nullable: true,
            metadata: {},
          },
        ],
      }),
      partitionColumns: [],
      configuration: {},
      version: 1,
    };

    it("should successfully process Parquet files and return SchemaData", async () => {
      // Create mock Parquet data using Apache Arrow
      const table = Arrow.tableFromArrays({
        id: [1, 2, 3],
        name: ["Alice", "Bob", "Charlie"],
        created_at: [Date.now(), Date.now() + 1000, Date.now() + 2000],
      });

      // Use Arrow record batch format which the reader can understand
      // Convert to Buffer to ensure nock handles binary data correctly
      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file1.parquet",
          id: "file1",
          partitionValues: {},
          size: buffer.length,
          stats: JSON.stringify({ numRecords: 3 }),
          version: 1,
          timestamp: Date.now(),
        },
      ];

      // Mock HTTP request for Parquet file
      nock("https://example.com").get("/file1.parquet").reply(200, buffer, {
        "Content-Type": "application/octet-stream",
      });

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.columns).toHaveLength(3);
      expect(schemaData.columns[0]).toEqual({
        name: "id",
        type_name: "long",
        type_text: "long",
      });
      expect(schemaData.columns[1]).toEqual({
        name: "name",
        type_name: "string",
        type_text: "string",
      });
      expect(schemaData.columns[2]).toEqual({
        name: "created_at",
        type_name: "timestamp",
        type_text: "timestamp",
      });

      expect(schemaData.rows).toHaveLength(3);
      expect(schemaData.rows[0]).toEqual(["1", "Alice", expect.any(String)]);
      expect(schemaData.rows[1]).toEqual(["2", "Bob", expect.any(String)]);
      expect(schemaData.rows[2]).toEqual(["3", "Charlie", expect.any(String)]);

      expect(schemaData.totalRows).toBe(3);
      expect(schemaData.truncated).toBe(false);
    });

    it("should handle files with null values correctly", async () => {
      // Create mock Parquet data with null values
      const table = Arrow.tableFromArrays({
        id: [1, 2],
        name: ["Alice", null], // null value
      });

      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file_with_nulls.parquet",
          id: "file_with_nulls",
          partitionValues: {},
          size: buffer.length,
          stats: JSON.stringify({ numRecords: 2 }),
        },
      ];

      const mockMetadataWithNulls: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "long",
              nullable: false,
              metadata: {},
            },
            {
              name: "name",
              type: "string",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/file_with_nulls.parquet").reply(200, buffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadataWithNulls);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(2);
      expect(schemaData.rows[0]).toEqual(["1", "Alice"]);
      expect(schemaData.rows[1]).toEqual(["2", null]); // null value preserved
    });

    it("should handle complex data types by JSON stringifying them", async () => {
      // Create mock Parquet data with complex types
      const table = Arrow.tableFromArrays({
        id: [1],
        metadata: [JSON.stringify({ key: "value", nested: { count: 42 } })],
      });

      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/complex_types.parquet",
          id: "complex_types",
          partitionValues: {},
          size: buffer.length,
        },
      ];

      const mockMetadataComplex: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "long",
              nullable: false,
              metadata: {},
            },
            {
              name: "metadata",
              type: "struct",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/complex_types.parquet").reply(200, buffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadataComplex);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(1);
      expect(schemaData.rows[0][0]).toBe("1");
      expect(schemaData.rows[0][1]).toBe(JSON.stringify({ key: "value", nested: { count: 42 } }));
    });

    it("should respect limit hint and truncate results", async () => {
      // Create mock Parquet data with more rows than limit
      const table = Arrow.tableFromArrays({
        id: [1, 2, 3, 4, 5],
        name: ["A", "B", "C", "D", "E"],
      });

      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/large_file.parquet",
          id: "large_file",
          partitionValues: {},
          size: buffer.length,
        },
      ];

      const limitedMetadata: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "long",
              nullable: false,
              metadata: {},
            },
            {
              name: "name",
              type: "string",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/large_file.parquet").reply(200, buffer);

      // Execute processFiles with limit hint
      const limitHint = 3;
      const result = await dataService.processFiles(mockFiles, limitedMetadata, limitHint);

      // Assert result is success but truncated
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(3); // Limited to 3 rows
      expect(schemaData.totalRows).toBe(3);
      expect(schemaData.truncated).toBe(true);
    });

    it("should handle multiple files and combine their data", async () => {
      // Create two separate tables
      const table1 = Arrow.tableFromArrays({
        id: [1, 2],
        name: ["Alice", "Bob"],
      });

      const table2 = Arrow.tableFromArrays({
        id: [3, 4],
        name: ["Charlie", "Diana"],
      });

      const buffer1 = Buffer.from(Arrow.tableToIPC(table1, "stream"));
      const buffer2 = Buffer.from(Arrow.tableToIPC(table2, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file1.parquet",
          id: "file1",
          partitionValues: {},
          size: buffer1.length,
        },
        {
          url: "https://example.com/file2.parquet",
          id: "file2",
          partitionValues: {},
          size: buffer2.length,
        },
      ];

      const multiFileMetadata: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "long",
              nullable: false,
              metadata: {},
            },
            {
              name: "name",
              type: "string",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP requests for both files
      nock("https://example.com")
        .get("/file1.parquet")
        .reply(200, buffer1)
        .get("/file2.parquet")
        .reply(200, buffer2);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, multiFileMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(4); // Combined data from both files
      expect(schemaData.rows[0]).toEqual(["1", "Alice"]);
      expect(schemaData.rows[1]).toEqual(["2", "Bob"]);
      expect(schemaData.rows[2]).toEqual(["3", "Charlie"]);
      expect(schemaData.rows[3]).toEqual(["4", "Diana"]);
      expect(schemaData.totalRows).toBe(4);
      expect(schemaData.truncated).toBe(false);
    });

    it("should continue processing other files if one fails", async () => {
      // Create valid table for successful file
      const table = Arrow.tableFromArrays({
        id: [1, 2],
        name: ["Alice", "Bob"],
      });

      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/bad_file.parquet",
          id: "bad_file",
          partitionValues: {},
          size: 1000,
        },
        {
          url: "https://example.com/good_file.parquet",
          id: "good_file",
          partitionValues: {},
          size: buffer.length,
        },
      ];

      const partialFailureMetadata: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "long",
              nullable: false,
              metadata: {},
            },
            {
              name: "name",
              type: "string",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP requests - first fails, second succeeds
      nock("https://example.com")
        .get("/bad_file.parquet")
        .reply(500, "Server Error")
        .get("/good_file.parquet")
        .reply(200, buffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, partialFailureMetadata);

      // Assert result is success (partial success)
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(2); // Only data from successful file
      expect(schemaData.rows[0]).toEqual(["1", "Alice"]);
      expect(schemaData.rows[1]).toEqual(["2", "Bob"]);
    });

    it("should handle HTTP request timeout", async () => {
      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/timeout_file.parquet",
          id: "timeout_file",
          partitionValues: {},
          size: 1000,
        },
      ];

      // Mock timeout by delaying response beyond service timeout
      nock("https://example.com")
        .get("/timeout_file.parquet")
        .delay(2000)
        .reply(200, "delayed response");

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadata);

      // Should still return success but with empty data since file failed
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.rows).toHaveLength(0);
    }, 3000); // Set test timeout to 2 seconds

    it("should handle invalid schema string", async () => {
      const invalidMetadata: DeltaMetadata = {
        ...mockMetadata,
        schemaString: "invalid json",
      };

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file.parquet",
          id: "file",
          partitionValues: {},
          size: 1000,
        },
      ];

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, invalidMetadata);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to process Delta Sharing data");
    });

    it("should handle empty files array", async () => {
      const mockFiles: DeltaFile[] = [];

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadata);

      // Assert result is success with empty data
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.columns).toHaveLength(3); // Schema columns should still be present
      expect(schemaData.rows).toHaveLength(0);
      expect(schemaData.totalRows).toBe(0);
      expect(schemaData.truncated).toBe(false);
    });
  });

  describe("applyLimitHint", () => {
    const mockFiles: DeltaFile[] = [
      {
        url: "https://example.com/file1.parquet",
        id: "file1",
        partitionValues: {},
        size: 1000,
        stats: JSON.stringify({ numRecords: 100 }),
      },
      {
        url: "https://example.com/file2.parquet",
        id: "file2",
        partitionValues: {},
        size: 2000,
        stats: JSON.stringify({ numRecords: 200 }),
      },
      {
        url: "https://example.com/file3.parquet",
        id: "file3",
        partitionValues: {},
        size: 3000,
        stats: JSON.stringify({ numRecords: 300 }),
      },
    ];

    it("should return all files when no limit hint provided", () => {
      const result = dataService.applyLimitHint(mockFiles, 0);
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockFiles);
    });

    it("should return all files when limit hint is negative", () => {
      const result = dataService.applyLimitHint(mockFiles, -10);
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockFiles);
    });

    it("should select files until estimated rows meet limit hint", () => {
      const result = dataService.applyLimitHint(mockFiles, 250);
      expect(result).toHaveLength(2); // First two files: 100 + 200 = 300 >= 250
      expect(result[0].id).toBe("file1");
      expect(result[1].id).toBe("file2");
    });

    it("should select only first file if it meets limit hint", () => {
      const result = dataService.applyLimitHint(mockFiles, 50);
      expect(result).toHaveLength(1); // First file: 100 >= 50
      expect(result[0].id).toBe("file1");
    });

    it("should handle files without stats gracefully", () => {
      const filesWithoutStats: DeltaFile[] = [
        {
          url: "https://example.com/no_stats1.parquet",
          id: "no_stats1",
          partitionValues: {},
          size: 1000,
          // No stats field
        },
        {
          url: "https://example.com/no_stats2.parquet",
          id: "no_stats2",
          partitionValues: {},
          size: 2000,
          // No stats field
        },
      ];

      const result = dataService.applyLimitHint(filesWithoutStats, 100);
      expect(result).toHaveLength(2); // Should include all files since we can't estimate
    });

    it("should handle files with invalid stats JSON", () => {
      const filesWithInvalidStats: DeltaFile[] = [
        {
          url: "https://example.com/invalid_stats1.parquet",
          id: "invalid_stats1",
          partitionValues: {},
          size: 1000,
          stats: "invalid json",
        },
        {
          url: "https://example.com/invalid_stats2.parquet",
          id: "invalid_stats2",
          partitionValues: {},
          size: 2000,
          stats: JSON.stringify({ numRecords: 150 }),
        },
      ];

      const result = dataService.applyLimitHint(filesWithInvalidStats, 100);
      expect(result).toHaveLength(2); // Should include both files
    });

    it("should handle stats without numRecords field", () => {
      const filesWithoutNumRecords: DeltaFile[] = [
        {
          url: "https://example.com/no_num_records.parquet",
          id: "no_num_records",
          partitionValues: {},
          size: 1000,
          stats: JSON.stringify({ size: 1000, other_field: "value" }),
        },
      ];

      const result = dataService.applyLimitHint(filesWithoutNumRecords, 100);
      expect(result).toHaveLength(1); // Should include the file
    });
  });

  describe("private method behaviors", () => {
    it("should handle different data types in parquet files", async () => {
      // Test various Arrow data types
      const table = Arrow.tableFromArrays({
        bool_col: [true, false, true],
        int_col: [1, 2, 3],
        float_col: [1.1, 2.2, 3.3],
        date_col: [new Date("2023-01-01"), new Date("2023-01-02"), new Date("2023-01-03")],
      });

      const buffer = Buffer.from(Arrow.tableToIPC(table, "stream"));

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/types_test.parquet",
          id: "types_test",
          partitionValues: {},
          size: buffer.length,
        },
      ];

      const typesMetadata: DeltaMetadata = {
        id: "test-metadata-id",
        format: {
          provider: "parquet",
        },
        partitionColumns: [],
        configuration: {},
        version: 1,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            { name: "bool_col", type: "boolean", nullable: true, metadata: {} },
            { name: "int_col", type: "integer", nullable: true, metadata: {} },
            { name: "float_col", type: "double", nullable: true, metadata: {} },
            { name: "date_col", type: "date", nullable: true, metadata: {} },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/types_test.parquet").reply(200, buffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, typesMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(3);

      // Check that different types are converted to strings
      expect(schemaData.rows[0]).toEqual(["true", "1", "1.1", expect.any(String)]);
      expect(schemaData.rows[1]).toEqual(["false", "2", "2.2", expect.any(String)]);
      expect(schemaData.rows[2]).toEqual(["true", "3", "3.3", expect.any(String)]);
    });
  });
});
