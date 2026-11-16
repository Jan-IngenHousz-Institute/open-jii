import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { DeviceRegistryWarehouseRepository } from "./device-registry-warehouse.repository";
import type { RegisteredDevice } from "./experiment-device-registry.repository";

describe("DeviceRegistryWarehouseRepository", () => {
  const testApp = TestHarness.App;
  let repository: DeviceRegistryWarehouseRepository;
  let databricksPort: DatabricksPort;

  const nothing: SchemaData = { columns: [], rows: [], totalRows: 0, truncated: false };
  const registeredAt = new Date("2026-11-01T08:00:00.000Z");

  function device(overrides: Partial<RegisteredDevice> = {}): RegisteredDevice {
    return {
      id: faker.string.uuid(),
      thingName: "multispeq_SN1",
      serialNumber: "SN1",
      createdBy: faker.string.uuid(),
      status: "active",
      deviceType: "multispeq",
      registeredAt,
      ...overrides,
    };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(DeviceRegistryWarehouseRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("merge", () => {
    it("writes every device in one statement, matched by the thing name the pipelines join on", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const active = device();
      const retired = device({
        thingName: "ambyte_SN2",
        serialNumber: "SN2",
        status: "retired",
        deviceType: "ambyte",
      });

      assertSuccess(await repository.merge([active, retired]));

      expect(execute).toHaveBeenCalledTimes(1);
      const [schema, statement, parameters] = execute.mock.calls[0];
      expect(schema).toBe(databricksPort.CENTRUM_SCHEMA_NAME);
      expect(statement).toContain("MERGE INTO device_registry AS target");
      expect(statement).toContain("ON target.thing_name = source.thing_name");
      expect(statement).toContain("id = source.id");
      expect(statement).toContain("WHEN NOT MATCHED THEN INSERT");
      const timestamp = { value: registeredAt.toISOString(), type: "TIMESTAMP" };
      expect(parameters).toEqual([
        { name: "id_0", value: active.id },
        { name: "thing_name_0", value: "multispeq_SN1" },
        { name: "serial_number_0", value: "SN1" },
        { name: "created_by_0", value: active.createdBy },
        { name: "status_0", value: "active" },
        { name: "device_type_0", value: "multispeq" },
        { name: "registered_at_0", ...timestamp },
        { name: "id_1", value: retired.id },
        { name: "thing_name_1", value: "ambyte_SN2" },
        { name: "serial_number_1", value: "SN2" },
        { name: "created_by_1", value: retired.createdBy },
        { name: "status_1", value: "retired" },
        { name: "device_type_1", value: "ambyte" },
        { name: "registered_at_1", ...timestamp },
      ]);
    });

    it("lets a row take only a registration as recent as its own, so a late copy of a deleted device leaves the one registered again in its place", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));

      assertSuccess(await repository.merge([device()]));

      const [, statement] = execute.mock.calls[0];
      expect(statement).toContain(
        "WHEN MATCHED AND source.registered_at >= target.registered_at THEN UPDATE SET",
      );
      expect(statement).toContain("registered_at = source.registered_at");
    });

    it("keeps a serial number out of the statement, as a parameter", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));

      assertSuccess(await repository.merge([device({ serialNumber: "SN'); DROP TABLE x; --" })]));

      const [, statement] = execute.mock.calls[0];
      expect(statement).not.toContain("DROP TABLE");
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

      const result = await repository.merge([device()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to merge registered devices: Warehouse down");
    });
  });

  describe("delete", () => {
    it("deletes the copies by device id in one statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const ids = [faker.string.uuid(), faker.string.uuid()];

      assertSuccess(await repository.delete(ids));

      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("DELETE FROM device_registry");
      expect(statement).toContain("WHERE id IN (:id_0, :id_1)");
      expect(parameters).toEqual([
        { name: "id_0", value: ids[0] },
        { name: "id_1", value: ids[1] },
      ]);
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

      const result = await repository.delete([faker.string.uuid()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete registered devices: Warehouse down");
    });
  });
});
