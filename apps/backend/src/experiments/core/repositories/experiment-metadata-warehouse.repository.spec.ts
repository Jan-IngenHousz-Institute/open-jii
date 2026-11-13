import { faker } from "@faker-js/faker";

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

    it("splits large sheets over statements of at most 4 MiB of documents", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(emptySchemaData));
      const large = () => sheet({ metadata: { note: "x".repeat(1_500_000) } });
      const sheets = [large(), large(), large()];

      assertSuccess(await repository.merge(sheets));

      expect(execute).toHaveBeenCalledTimes(2);
      const written = execute.mock.calls.map(([, , parameters]) =>
        (parameters ?? [])
          .filter(({ name }) => name.startsWith("metadata_id_"))
          .map(({ value }) => value),
      );
      expect(written).toEqual([[sheets[0].id, sheets[1].id], [sheets[2].id]]);
    });

    it("writes a sheet larger than the cap alone", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(emptySchemaData));

      assertSuccess(
        await repository.merge([sheet({ metadata: { note: "x".repeat(5_000_000) } }), sheet()]),
      );

      expect(execute).toHaveBeenCalledTimes(2);
    });

    it("stops at the first statement the warehouse refuses", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(failure(AppError.internal("Warehouse down")));
      const large = () => sheet({ metadata: { note: "x".repeat(3_000_000) } });

      const result = await repository.merge([large(), large()]);

      expect(result.isFailure()).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
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

  describe("statementGroups", () => {
    const sheet = (bytes: number) => ({ id: faker.string.uuid(), bytes });

    it("puts sheets in groups of at most 4 MiB, in the order given", () => {
      const sizes = [sheet(3_000_000), sheet(1_000_000), sheet(2_000_000), sheet(10)];

      expect(repository.statementGroups(sizes)).toEqual([
        [sizes[0].id, sizes[1].id],
        [sizes[2].id, sizes[3].id],
      ]);
    });

    it("gives a sheet larger than the cap a group of its own", () => {
      const sizes = [sheet(10), sheet(6 * 1024 * 1024), sheet(10)];

      expect(repository.statementGroups(sizes)).toEqual([
        [sizes[0].id],
        [sizes[1].id],
        [sizes[2].id],
      ]);
    });

    it("makes no group of no sheets", () => {
      expect(repository.statementGroups([])).toEqual([]);
    });
  });
});
