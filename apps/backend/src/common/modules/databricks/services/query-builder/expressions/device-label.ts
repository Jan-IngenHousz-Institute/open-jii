import type { SqlQueryBuilder } from "../query-builder.base";

/** The SQL each part of a device's label reads, quoted for the engine that runs it. */
export interface DeviceLabelColumns {
  serialNumber: string;
  deviceName: string;
  deviceId: string;
  /** Absent where the source has no client id column. */
  clientId?: string;
}

/**
 * A registered device's serial number, or else the name it reported, its client id or its device
 * id, with the device id after a name that differs from it. Spark and the store both run it.
 */
export function deviceLabel({
  serialNumber,
  deviceName,
  deviceId,
  clientId,
}: DeviceLabelColumns): string {
  const usable = (sql: string) => `nullif(trim(${sql}), '')`;
  const client = clientId === undefined ? "CAST(NULL AS STRING)" : usable(clientId);
  const name = `coalesce(${usable(deviceName)}, ${client}, ${usable(deviceId)})`;
  const id = `coalesce(${usable(deviceId)}, ${client})`;
  return `CASE WHEN ${usable(serialNumber)} IS NOT NULL THEN ${serialNumber} WHEN ${name} = ${id} THEN ${name} WHEN ${id} IS NOT NULL THEN concat(${name}, ' (', ${id}, ')') ELSE ${name} END`;
}

/** Replace Device before filtering or aggregation, only for platform experiment reads. */
export function deviceDisplaySource(
  table: string,
  builder: SqlQueryBuilder,
  columns?: string[],
): string {
  const fields = ["id", "serial_number", "owner", "status", "device_type"];
  const label = deviceLabel({
    serialNumber: builder.escapeIdentifier("device.serial_number"),
    deviceName: builder.escapeIdentifier("device_name"),
    deviceId: builder.escapeIdentifier("device_id"),
    clientId: columns?.includes("client_id") ? builder.escapeIdentifier("client_id") : undefined,
  });
  const device = `named_struct(${fields
    .map(
      (field) =>
        `${builder.escapeValue(field)}, ${field === "serial_number" ? label : builder.escapeIdentifier(`device.${field}`)}`,
    )
    .join(", ")})`;
  const projection = columns
    ? columns
        .map((column) =>
          column === "device" ? `${device} AS \`device\`` : builder.escapeIdentifier(column),
        )
        .join(", ")
    : `* EXCEPT (\`device\`), ${device} AS \`device\``;
  const sql = builder.selectRaw(projection).from(table).build();
  return `(${sql}) AS device_data`;
}
