import type { SqlQueryBuilder } from "../query-builder.base";

export function deviceLabel(builder: SqlQueryBuilder, clientIdAvailable: boolean): string {
  const serial = builder.escapeIdentifier("device.serial_number");
  const usable = (column: string) => `nullif(trim(${builder.escapeIdentifier(column)}), '')`;
  const client = clientIdAvailable ? usable("client_id") : "CAST(NULL AS STRING)";
  const name = `coalesce(${usable("device_name")}, ${client}, ${usable("device_id")})`;
  const id = `coalesce(${usable("device_id")}, ${client})`;
  return `CASE WHEN nullif(trim(${serial}), '') IS NOT NULL THEN ${serial} WHEN ${name} = ${id} THEN ${name} WHEN ${id} IS NOT NULL THEN concat(${name}, ' (', ${id}, ')') ELSE ${name} END`;
}

/** Replace Device before filtering or aggregation, only for platform experiment reads. */
export function deviceDisplaySource(
  table: string,
  builder: SqlQueryBuilder,
  columns?: string[],
): string {
  const fields = ["id", "serial_number", "owner", "status", "device_type"];
  const device = `named_struct(${fields
    .map(
      (field) =>
        `${builder.escapeValue(field)}, ${field === "serial_number" ? deviceLabel(builder, columns?.includes("client_id") ?? false) : builder.escapeIdentifier(`device.${field}`)}`,
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
