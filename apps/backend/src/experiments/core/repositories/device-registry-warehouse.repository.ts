import { Injectable, Inject } from "@nestjs/common";

import type { StatementParameter } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, failure, Result, success } from "../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";
import type { RegisteredDevice } from "./experiment-device-registry.repository";

/**
 * The lakehouse's copy of the device registry, `centrum.device_registry`, which the pipelines join
 * by the client id a device publishes under, its thing name. Postgres holds the registry; the
 * experiment data outbox keeps this copy to its state.
 */
@Injectable()
export class DeviceRegistryWarehouseRepository {
  constructor(
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Writes each device as Postgres holds it. Matched by thing name, the key the pipelines join on,
   * so a serial registered again after its device was deleted replaces the row that device left.
   */
  async merge(devices: RegisteredDevice[]): Promise<Result<void>> {
    if (devices.length === 0) {
      return success(undefined);
    }

    const parameters: StatementParameter[] = [];
    const rows = devices.map((device, i) => {
      parameters.push(
        { name: `id_${i}`, value: device.id },
        { name: `thing_name_${i}`, value: device.thingName },
        { name: `serial_number_${i}`, value: device.serialNumber },
        { name: `created_by_${i}`, value: device.createdBy ?? undefined },
        { name: `status_${i}`, value: device.status },
        { name: `device_type_${i}`, value: device.deviceType },
      );
      return `(:id_${i}, :thing_name_${i}, :serial_number_${i}, CAST(:created_by_${i} AS STRING), :status_${i}, :device_type_${i})`;
    });

    const statement = `
      MERGE INTO device_registry AS target
      USING (
        SELECT * FROM VALUES ${rows.join(", ")}
        AS copy(id, thing_name, serial_number, created_by, status, device_type)
      ) AS source
      ON target.thing_name = source.thing_name
      WHEN MATCHED THEN UPDATE SET
        id = source.id, serial_number = source.serial_number, created_by = source.created_by,
        status = source.status, device_type = source.device_type
      WHEN NOT MATCHED THEN INSERT (id, thing_name, serial_number, created_by, status, device_type)
        VALUES (source.id, source.thing_name, source.serial_number, source.created_by, source.status,
                source.device_type)
    `;

    return this.execute(statement, parameters, "merge registered devices");
  }

  /** Deletes the copies of devices Postgres no longer holds. */
  async delete(ids: string[]): Promise<Result<void>> {
    if (ids.length === 0) {
      return success(undefined);
    }

    const parameters = ids.map((id, i) => ({ name: `id_${i}`, value: id }));
    const statement = `
      DELETE FROM device_registry
      WHERE id IN (${parameters.map(({ name }) => `:${name}`).join(", ")})
    `;

    return this.execute(statement, parameters, "delete registered devices");
  }

  private async execute(
    statement: string,
    parameters: StatementParameter[],
    what: string,
  ): Promise<Result<void>> {
    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      statement,
      parameters,
    );
    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to ${what}: ${result.error.message}`));
    }

    return success(undefined);
  }
}
