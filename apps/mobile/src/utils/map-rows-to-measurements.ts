import { generatePseudoUUID } from "~/utils/generate-pseudo-uuid";

export interface MeasurementRecord {
  date: string;
  device_battery: string;
  device_firmware: string;
  device_id: string;
  device_name: string;
  device_type: string;
  experiment_id: string;
  experiment_import_timestamp: string;
  hour: string;
  ingest_latency_ms: string;
  md5_measurement: string;
  md5_protocol: string;
  measurement_type: string;
  measurement_value: string;
  plant_genotype: string;
  plant_id: string;
  plant_location: string;
  plant_name: string;
  processed_timestamp: string;
  quality_check_passed: string;
  sensor_id: string;
  standardized_unit: string;
  standardized_value: string;
  timestamp: string;
  topic: string;
  id: string;
}

export function mapRowsToMeasurements(rows: any[] | undefined): MeasurementRecord[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => ({
    id: generatePseudoUUID(row),
    ...row,
  }));
}
