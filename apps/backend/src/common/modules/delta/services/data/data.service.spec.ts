import nock from "nock";
import { vi } from "vitest";

import { TestHarness } from "../../../../../test/test-harness";
import { assertSuccess } from "../../../../utils/fp-utils";
import type { DeltaFile, DeltaMetadata } from "../shares/shares.types";
import { DeltaDataService } from "./data.service";

// Mock hyparquet — DataService calls both `parquetReadObjects` (for rows) and
// `parquetMetadata` (for schema + num_rows, used to drive column metadata and
// VARIANT detection). Both must be mocked or the file gets skipped silently.
const mockParquetReadObjects = vi.fn();
const mockParquetMetadata = vi.fn();
vi.mock("hyparquet", () => ({
  parquetReadObjects: mockParquetReadObjects,
  parquetMetadata: mockParquetMetadata,
}));
vi.mock("hyparquet-compressors", () => ({ compressors: {} }));

/** Build a parquet schema array in the shape hyparquet's `parquetMetadata` returns. */
const buildSchema = (
  fields: { name: string; type: string }[],
): { schema: { name: string; type?: string; num_children?: number }[]; num_rows: bigint } => ({
  schema: [{ name: "root", num_children: fields.length }, ...fields],
  num_rows: BigInt(fields.length),
});

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
    const baseMetadata: DeltaMetadata = {
      id: "metadata-id",
      format: { provider: "parquet" },
      schemaString: "",
      partitionColumns: [],
      configuration: {},
      version: 1,
    };

    const stubFile = (id = "file1"): DeltaFile => ({
      url: `https://example.com/${id}.parquet`,
      id,
      partitionValues: {},
      size: 100,
    });

    const stubDownload = (id: string): void => {
      nock("https://example.com").get(`/${id}.parquet`).reply(200, Buffer.from("parquet-stub"));
    };

    it("returns object-keyed rows derived from hyparquet's column projection and parquet schema", async () => {
      mockParquetMetadata.mockReturnValue(
        buildSchema([
          { name: "id", type: "INT64" },
          { name: "name", type: "BYTE_ARRAY" },
        ]),
      );
      mockParquetReadObjects.mockResolvedValue([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);

      stubDownload("file1");
      const result = await dataService.processFiles([stubFile()], baseMetadata);

      assertSuccess(result);
      expect(result.value.columns.map((c) => c.name)).toEqual(["id", "name"]);
      expect(result.value.rows).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);
      expect(result.value.totalRows).toBe(2);
      expect(result.value.truncated).toBe(false);
    });

    it("filters rows by the provided equality filters during decode", async () => {
      mockParquetMetadata.mockReturnValue(
        buildSchema([
          { name: "experiment_id", type: "BYTE_ARRAY" },
          { name: "value", type: "INT64" },
        ]),
      );
      mockParquetReadObjects.mockResolvedValue([
        { experiment_id: "exp-A", value: 1 },
        { experiment_id: "exp-B", value: 2 },
        { experiment_id: "exp-A", value: 3 },
      ]);

      stubDownload("file1");
      const result = await dataService.processFiles(
        [stubFile()],
        baseMetadata,
        undefined,
        undefined,
        { experiment_id: "exp-A" },
      );

      assertSuccess(result);
      const rows = result.value.rows as Record<string, unknown>[];
      expect(rows.map((r) => r.value)).toEqual([1, 3]);
    });

    it("truncates to the limit hint and reports truncated=true", async () => {
      mockParquetMetadata.mockReturnValue(buildSchema([{ name: "id", type: "INT64" }]));
      mockParquetReadObjects.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);

      stubDownload("file1");
      const result = await dataService.processFiles([stubFile()], baseMetadata, 2);

      assertSuccess(result);
      expect(result.value.rows).toHaveLength(2);
      expect(result.value.truncated).toBe(true);
    });

    it("skips a file whose download fails and continues with the rest", async () => {
      mockParquetMetadata.mockReturnValue(buildSchema([{ name: "id", type: "INT64" }]));
      mockParquetReadObjects.mockResolvedValue([{ id: 99 }]);

      // First file errors out at the HTTP layer; second succeeds.
      nock("https://example.com").get("/bad.parquet").reply(500);
      stubDownload("good");

      const result = await dataService.processFiles(
        [stubFile("bad"), stubFile("good")],
        baseMetadata,
      );

      assertSuccess(result);
      expect(result.value.rows).toEqual([{ id: 99 }]);
    });
  });

  describe("pruneFilesByEquality", () => {
    const fileWithStats = (id: string, stats: object): DeltaFile => ({
      url: `https://example.com/${id}.parquet`,
      id,
      partitionValues: {},
      size: 100,
      stats: JSON.stringify(stats),
    });

    it("returns the input unchanged when no filters are provided", () => {
      const files = [fileWithStats("a", { numRecords: 1 })];
      expect(dataService.pruneFilesByEquality(files, {})).toBe(files);
    });

    it("drops files whose [min, max] range cannot contain the filter value", () => {
      const files = [
        fileWithStats("in", {
          numRecords: 1,
          minValues: { experiment_id: "exp-001" },
          maxValues: { experiment_id: "exp-999" },
        }),
        fileWithStats("out", {
          numRecords: 1,
          minValues: { experiment_id: "exp-aaa" },
          maxValues: { experiment_id: "exp-zzz" },
        }),
      ];

      const result = dataService.pruneFilesByEquality(files, { experiment_id: "exp-500" });
      expect(result.map((f) => f.id)).toEqual(["in"]);
    });

    it("keeps files with no parsable stats (conservative)", () => {
      const files = [
        { ...fileWithStats("a", {}), stats: undefined } as DeltaFile,
        { ...fileWithStats("b", {}), stats: "not-json" } as DeltaFile,
      ];
      const result = dataService.pruneFilesByEquality(files, { experiment_id: "exp-1" });
      expect(result.map((f) => f.id)).toEqual(["a", "b"]);
    });

    it("keeps files whose stats lack min/max for the filtered column", () => {
      const files = [fileWithStats("a", { numRecords: 1, minValues: {}, maxValues: {} })];
      const result = dataService.pruneFilesByEquality(files, { experiment_id: "exp-1" });
      expect(result.map((f) => f.id)).toEqual(["a"]);
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
