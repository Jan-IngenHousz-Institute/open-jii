import { generatePseudoUUID } from "~/utils/generate-pseudo-uuid";

export interface MeasurementRecord {
  id: string;
  device_id: string;
  sensor_id: string;
  experiment_id: string;
  timestamp: string;
  date: string;
  hour: number;
  measurement_type: string;
  measurement_value: number;
  md5_protocol: string;
  md5_measurement: string;
  standardized_value: number;
  standardized_unit: string;
  quality_check_passed: boolean;
  device_type: string;
  device_name: string;
  device_battery: number;
  device_firmware: string;
  plant_id: string;
  plant_name: string;
  plant_genotype: string;
  plant_location: string;
  ingest_latency_ms: number;
  processed_timestamp: string;
  topic: string;
  experiment_import_timestamp: string;
}

export function mapRowsToMeasurements(
  columns: { name: string; type_name: string }[],
  rows: any[][],
): MeasurementRecord[] {
  return rows.map((row) => {
    const rawRecord: any = {};

    for (let i = 0; i < columns.length; i++) {
      const { name, type_name } = columns[i];
      let value = row[i];

      switch (type_name) {
        case "INT":
        case "LONG":
          value = parseInt(value, 10);
          break;
        case "DOUBLE":
          value = parseFloat(value);
          break;
        case "BOOLEAN":
          value = value === "true" || value === true;
          break;
        // STRING, TIMESTAMP, DATE remain unchanged
      }

      rawRecord[name] = value;
    }

    const id = generatePseudoUUID(rawRecord);
    return { id, ...rawRecord } as MeasurementRecord;
  });
}
