import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

/**
 * Example tables a ticket screen reads instead of the warehouse. Every number is made up from a
 * fixed seed, so a recapture draws the same picture.
 */
export type FixtureValue = string | number | boolean | null;

export type FixtureRow = Readonly<Record<string, FixtureValue>>;

export interface FixtureTable {
  readonly identifier: string;
  readonly displayName: string;
  readonly columns: readonly ExperimentDataColumn[];
  readonly rows: readonly FixtureRow[];
  readonly defaultSortColumn?: string;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const column = (name: string, type: string): ExperimentDataColumn => ({
  name,
  type_name: type,
  type_text: type,
});

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

function droughtTrialRows(): FixtureRow[] {
  const random = seededRandom(3);
  const genotypes = ["Wild type", "Line A", "Line B"];
  const treatments = ["control", "drought", "recovery"];
  const rows: FixtureRow[] = [];
  let plant = 0;

  for (const genotype of genotypes) {
    for (const treatment of treatments) {
      for (let replicate = 0; replicate < 4; replicate += 1) {
        plant += 1;
        for (let day = 0; day < 5; day += 1) {
          const light = round(150 + random() * 1050, 0);
          const drought = treatment === "drought" ? 0.12 : treatment === "recovery" ? 0.05 : 0;
          const line = genotype === "Wild type" ? 0 : 0.45;
          rows.push({
            timestamp: new Date(Date.UTC(2026, 5, 2 + day, 9 + replicate, 12)).toISOString(),
            plant_id: `P-${String(plant).padStart(3, "0")}`,
            genotype,
            treatment,
            light_intensity: light,
            efficiency: round(0.72 - light / 2600 - drought + (random() - 0.5) * 0.06, 3),
            stress_index: round(0.6 + light / 700 + line + drought * 3 + (random() - 0.5) * 0.4, 2),
          });
        }
      }
    }
  }
  return rows;
}

function sensorFleetRows(): FixtureRow[] {
  const random = seededRandom(11);
  const end = Date.UTC(2026, 8, 29, 8, 0);
  const rows: FixtureRow[] = [];

  for (let device = 1; device <= 24; device += 1) {
    const battery = 3.6 + random() * 0.55;
    for (let slot = 0; slot < 96; slot += 1) {
      if (random() < 0.08) continue;
      rows.push({
        timestamp: new Date(end - slot * 15 * 60_000).toISOString(),
        device_id: `sensor-${String(device).padStart(3, "0")}`,
        battery_v: round(battery - slot * 0.0004 + (random() - 0.5) * 0.02, 3),
        rssi_dbm: round(-60 - random() * 35, 0),
        online: random() > 0.03,
      });
    }
  }
  return rows;
}

/** Plants under three treatments, measured once a day for five days. */
export const DROUGHT_TRIAL_TABLE: FixtureTable = {
  identifier: "6f3c1a52-0b7e-4c9a-9d41-2a5e8b7c0d13",
  displayName: "Leaf measurements",
  columns: [
    column("timestamp", "TIMESTAMP"),
    column("plant_id", "STRING"),
    column("genotype", "STRING"),
    column("treatment", "STRING"),
    column("light_intensity", "DOUBLE"),
    column("efficiency", "DOUBLE"),
    column("stress_index", "DOUBLE"),
  ],
  rows: droughtTrialRows(),
  defaultSortColumn: "timestamp",
};

/** A day of 15-minute heartbeats from a fleet of field sensors. */
export const SENSOR_FLEET_TABLE: FixtureTable = {
  identifier: "0d9e4b7a-5c21-4f6e-8a3b-7e1c2d4f5a60",
  displayName: "Device heartbeat",
  columns: [
    column("timestamp", "TIMESTAMP"),
    column("device_id", "STRING"),
    column("battery_v", "DOUBLE"),
    column("rssi_dbm", "DOUBLE"),
    column("online", "BOOLEAN"),
  ],
  rows: sensorFleetRows(),
  defaultSortColumn: "timestamp",
};
