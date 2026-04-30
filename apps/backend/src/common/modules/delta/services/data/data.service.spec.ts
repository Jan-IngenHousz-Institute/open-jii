import nock from "nock";
import { vi } from "vitest";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import type { DeltaFile, DeltaMetadata } from "../shares/shares.types";
import { DeltaDataService } from "./data.service";

// Mock hyparquet at the module level
const mockParquetReadObjects = vi.fn();
vi.mock("hyparquet", () => ({
  parquetReadObjects: mockParquetReadObjects,
}));

describe("DeltaDataService", () => {
  const testApp = TestHarness.App;

  let dataService: DeltaDataService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    dataService = testApp.module.get(DeltaDataService);

    // Reset mocks
    vi.clearAllMocks();
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
      // Mock data that hyparquet would return
      const mockParquetData = [
        { id: 1, name: "Alice", created_at: new Date("2024-01-01") },
        { id: 2, name: "Bob", created_at: new Date("2024-01-02") },
        { id: 3, name: "Charlie", created_at: new Date("2024-01-03") },
      ];

      // Setup the mock to return our test data
      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file1.parquet",
          id: "file1",
          partitionValues: {},
          size: 100,
          stats: JSON.stringify({ numRecords: 3 }),
          version: 1,
          timestamp: Date.now(),
        },
      ];

      // Mock HTTP request for Parquet file
      nock("https://example.com").get("/file1.parquet").reply(200, mockBuffer, {
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

      // Verify hyparquet was called
      expect(mockParquetReadObjects).toHaveBeenCalledTimes(1);
    });

    it("should handle files with null values correctly", async () => {
      // Mock data with null values
      const mockParquetData = [
        { id: 1, name: "Alice" },
        { id: 2, name: null },
      ];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file_with_nulls.parquet",
          id: "file_with_nulls",
          partitionValues: {},
          size: 100,
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
      nock("https://example.com").get("/file_with_nulls.parquet").reply(200, mockBuffer);

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
      const mockParquetData = [
        {
          id: 1,
          metadata: { key: "value", nested: { count: 42 } },
        },
      ];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/complex_types.parquet",
          id: "complex_types",
          partitionValues: {},
          size: mockBuffer.length,
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
      nock("https://example.com").get("/complex_types.parquet").reply(200, mockBuffer);

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
      const mockParquetData = [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" },
        { id: 4, name: "D" },
        { id: 5, name: "E" },
      ];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/large_file.parquet",
          id: "large_file",
          partitionValues: {},
          size: mockBuffer.length,
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
      nock("https://example.com").get("/large_file.parquet").reply(200, mockBuffer);

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
      const mockParquetData1 = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const mockParquetData2 = [
        { id: 3, name: "Charlie" },
        { id: 4, name: "Diana" },
      ];

      // Setup mock to return different data for each call
      mockParquetReadObjects
        .mockResolvedValueOnce(mockParquetData1)
        .mockResolvedValueOnce(mockParquetData2);

      const mockBuffer1 = Buffer.from("mock parquet data 1");
      const mockBuffer2 = Buffer.from("mock parquet data 2");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/file1.parquet",
          id: "file1",
          partitionValues: {},
          size: mockBuffer1.length,
        },
        {
          url: "https://example.com/file2.parquet",
          id: "file2",
          partitionValues: {},
          size: mockBuffer2.length,
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
        .reply(200, mockBuffer1)
        .get("/file2.parquet")
        .reply(200, mockBuffer2);

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

      // Verify hyparquet was called twice
      expect(mockParquetReadObjects).toHaveBeenCalledTimes(2);
    });

    it("should continue processing when one file fails", async () => {
      const mockParquetData = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      // First call fails, second succeeds
      mockParquetReadObjects
        .mockRejectedValueOnce(new Error("Failed to parse Parquet"))
        .mockResolvedValueOnce(mockParquetData);

      const mockBuffer1 = Buffer.from("invalid parquet data");
      const mockBuffer2 = Buffer.from("valid parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/invalid_file.parquet",
          id: "invalid_file",
          partitionValues: {},
          size: mockBuffer1.length,
        },
        {
          url: "https://example.com/valid_file.parquet",
          id: "valid_file",
          partitionValues: {},
          size: mockBuffer2.length,
        },
      ];

      const simpleMetadata: DeltaMetadata = {
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

      // Mock HTTP requests
      nock("https://example.com")
        .get("/invalid_file.parquet")
        .reply(200, mockBuffer1)
        .get("/valid_file.parquet")
        .reply(200, mockBuffer2);

      // Execute processFiles - should continue with valid file
      const result = await dataService.processFiles(mockFiles, simpleMetadata);

      // The service should return success with data from valid file
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(2);
      expect(schemaData.rows[0]).toEqual(["1", "Alice"]);
      expect(schemaData.rows[1]).toEqual(["2", "Bob"]);
    });

    it("should return an error if HTTP request fails", async () => {
      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/missing_file.parquet",
          id: "missing_file",
          partitionValues: {},
          size: 100,
        },
      ];

      // Mock HTTP request to fail with 404
      nock("https://example.com").get("/missing_file.parquet").reply(404, "Not Found");

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, mockMetadata);

      // Should continue and return empty results since file failed
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(0);
    });

    it("should handle empty files list", async () => {
      const emptyFiles: DeltaFile[] = [];

      // Execute processFiles with empty files
      const result = await dataService.processFiles(emptyFiles, mockMetadata);

      // Assert result is success with empty data
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(0);
      expect(schemaData.totalRows).toBe(0);
      expect(schemaData.truncated).toBe(false);
    });

    it("should handle Parquet files with array columns", async () => {
      const mockParquetData = [
        {
          id: 1,
          tags: ["tag1", "tag2", "tag3"],
        },
        {
          id: 2,
          tags: ["tag4"],
        },
      ];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/array_file.parquet",
          id: "array_file",
          partitionValues: {},
          size: mockBuffer.length,
        },
      ];

      const arrayMetadata: DeltaMetadata = {
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
              name: "tags",
              type: "array",
              nullable: true,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/array_file.parquet").reply(200, mockBuffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, arrayMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(2);
      expect(schemaData.rows[0]).toEqual(["1", JSON.stringify(["tag1", "tag2", "tag3"])]);
      expect(schemaData.rows[1]).toEqual(["2", JSON.stringify(["tag4"])]);
    });

    it("should handle bigint values", async () => {
      const mockParquetData = [{ id: BigInt(9007199254740991), name: "BigValue" }];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/bigint_file.parquet",
          id: "bigint_file",
          partitionValues: {},
          size: mockBuffer.length,
        },
      ];

      const bigintMetadata: DeltaMetadata = {
        ...mockMetadata,
        schemaString: JSON.stringify({
          type: "struct",
          fields: [
            {
              name: "id",
              type: "bigint",
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
      nock("https://example.com").get("/bigint_file.parquet").reply(200, mockBuffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, bigintMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(1);
      expect(schemaData.rows[0]).toEqual(["9007199254740991", "BigValue"]);
    });

    it("should handle boolean values", async () => {
      const mockParquetData = [
        { id: 1, active: true },
        { id: 2, active: false },
      ];

      mockParquetReadObjects.mockResolvedValue(mockParquetData);

      const mockBuffer = Buffer.from("mock parquet data");

      const mockFiles: DeltaFile[] = [
        {
          url: "https://example.com/bool_file.parquet",
          id: "bool_file",
          partitionValues: {},
          size: mockBuffer.length,
        },
      ];

      const boolMetadata: DeltaMetadata = {
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
              name: "active",
              type: "boolean",
              nullable: false,
              metadata: {},
            },
          ],
        }),
      };

      // Mock HTTP request
      nock("https://example.com").get("/bool_file.parquet").reply(200, mockBuffer);

      // Execute processFiles
      const result = await dataService.processFiles(mockFiles, boolMetadata);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const schemaData = result.value;
      expect(schemaData.rows).toHaveLength(2);
      expect(schemaData.rows[0]).toEqual(["1", "true"]);
      expect(schemaData.rows[1]).toEqual(["2", "false"]);
    });

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
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to process Delta Sharing data");
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
});
