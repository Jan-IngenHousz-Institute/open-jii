/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { Logger } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentMetadataWarehouseRepository } from "./experiment-metadata-warehouse.repository";

describe("ExperimentMetadataWarehouseRepository", () => {
  const now = new Date("2026-09-01T08:00:00.000Z");
  const testApp = TestHarness.App;
  let repository: ExperimentMetadataWarehouseRepository;
  let databricksPort: DatabricksPort;

  const mockExperimentId = faker.string.uuid();
  const mockUserId = faker.string.uuid();
  const mockMetadataId = faker.string.uuid();

  const mockMetadata = {
    columns: [
      { id: "col-1", name: "Species", type: "string" },
      { id: "col-2", name: "Count", type: "number" },
    ],
    rows: [
      { _id: "row-1", "col-1": "Oak", "col-2": 42 },
      { _id: "row-2", "col-1": "Pine", "col-2": 17 },
    ],
  };

  /** Helper to build a SchemaData response matching the metadata table shape */
  function buildMetadataSchemaData(
    overrides?: Partial<{
      metadataId: string;
      experimentId: string;
      metadata: Record<string, unknown>;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    }>,
  ): SchemaData {
    return {
      columns: [
        { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
        { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
        { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
        { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
        { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
        { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
      ],
      rows: [
        [
          overrides?.metadataId ?? mockMetadataId,
          overrides?.experimentId ?? mockExperimentId,
          JSON.stringify(overrides?.metadata ?? mockMetadata),
          overrides?.createdBy ?? mockUserId,
          overrides?.createdAt ?? "2026-01-15T10:00:00.000Z",
          overrides?.updatedAt ?? "2026-01-15T10:00:00.000Z",
        ],
      ],
      totalRows: 1,
      truncated: false,
    };
  }

  const emptySchemaData: SchemaData = {
    columns: [],
    rows: [],
    totalRows: 0,
    truncated: false,
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentMetadataWarehouseRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("findAllByExperimentId", () => {
    it("should return metadata array when found", async () => {
      const schemaData = buildMetadataSchemaData();
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      const metadataList = result.value;
      expect(metadataList).toHaveLength(1);
      expect(metadataList[0].metadataId).toBe(mockMetadataId);
      expect(metadataList[0].experimentId).toBe(mockExperimentId);
      expect(metadataList[0].metadata).toEqual(mockMetadata);
      expect(metadataList[0].createdBy).toBe(mockUserId);
      expect(metadataList[0].createdAt).toBeInstanceOf(Date);
      expect(metadataList[0].updatedAt).toBeInstanceOf(Date);
    });

    it("should return empty array when no metadata exists", async () => {
      const schemaData: SchemaData = {
        ...buildMetadataSchemaData(),
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should bind the experiment ID as a statement parameter", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(buildMetadataSchemaData()),
      );

      await repository.findAllByExperimentId(mockExperimentId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("WHERE experiment_id = :experiment_id"),
        [{ name: "experiment_id", value: mockExperimentId }],
      );
    });

    it("should reject invalid experiment ID format", async () => {
      const result = await repository.findAllByExperimentId("not-a-uuid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when Databricks query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Databricks connection failed")),
      );

      const result = await repository.findAllByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("merge", () => {
    function sheet(overrides: Partial<MetadataSheetRecord> = {}): MetadataSheetRecord {
      return {
        id: faker.string.uuid(),
        experimentId: mockExperimentId,
        metadata: mockMetadata,
        createdBy: mockUserId,
        createdAt: now,
        updatedAt: new Date("2026-09-02T08:00:00.000Z"),
        ...overrides,
      };
    }

    it("writes every sheet in one statement, its document through PARSE_JSON", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(emptySchemaData));
      const plots = sheet();
      const devices = sheet({ metadata: { name: "Devices" } });

      assertSuccess(await repository.merge([plots, devices]));

      expect(execute).toHaveBeenCalledTimes(1);
      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("experiment_custom_metadata AS target");
      expect(statement).toContain("PARSE_JSON(metadata)");
      expect(statement).toContain("ON target.metadata_id = source.metadata_id");
      expect(parameters).toEqual(
        expect.arrayContaining([
          { name: "metadata_id_0", value: plots.id },
          { name: "metadata_0", value: JSON.stringify(mockMetadata) },
          { name: "created_at_0", value: now.toISOString(), type: "TIMESTAMP" },
          { name: "metadata_id_1", value: devices.id },
          { name: "metadata_1", value: JSON.stringify({ name: "Devices" }) },
        ]),
      );
    });

    it("keeps the sheets' values out of the statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(emptySchemaData));

      assertSuccess(await repository.merge([sheet({ metadata: { field: "farmer's plot" } })]));

      expect(execute.mock.calls[0][1]).not.toContain("farmer");
    });

    it("sends nothing when there is nothing to write", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.merge([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.merge([sheet()]);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("delete", () => {
    it("deletes the copies by id in one statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(emptySchemaData));

      assertSuccess(await repository.delete([mockMetadataId]));

      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("WHERE metadata_id IN (:metadata_id_0)");
      expect(parameters).toEqual([{ name: "metadata_id_0", value: mockMetadataId }]);
    });

    it("sends nothing when nothing is gone", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.delete([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.delete([mockMetadataId]);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("mapRowToDto – edge cases", () => {
    it("should handle null metadata JSON gracefully", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
          { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
          { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
          { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
          { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
          { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
        ],
        rows: [[mockMetadataId, mockExperimentId, null, mockUserId, null, null]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value[0].metadata).toEqual({});
      expect(result.value[0].createdAt).toEqual(new Date(0));
      expect(result.value[0].updatedAt).toEqual(new Date(0));
    });

    it("should handle invalid metadata JSON gracefully", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
          { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
          { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
          { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
          { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
          { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
        ],
        rows: [
          [
            mockMetadataId,
            mockExperimentId,
            "NOT VALID JSON {{{",
            mockUserId,
            "2026-01-15T10:00:00.000Z",
            "2026-01-15T10:00:00.000Z",
          ],
        ],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      // Invalid JSON should fallback to empty object
      expect(result.value[0].metadata).toEqual({});
      expect(warn).toHaveBeenCalledWith({
        msg: "Failed to parse metadata JSON",
        metadataId: mockMetadataId,
        length: "NOT VALID JSON {{{".length,
      });
    });

    it("should handle missing column values gracefully", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
          { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
          { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
          { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
          { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
          { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
        ],
        rows: [[null, null, null, null, null, null]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value[0].metadataId).toBe("");
      expect(result.value[0].experimentId).toBe("");
      expect(result.value[0].createdBy).toBe("");
    });
  });
});
