import { v4 as uuidv4 } from "uuid";
import { getOutbox } from "~/shared/composition/upload";
import { saveMeasurement } from "~/shared/db/measurements-storage";
import type { Measurement } from "~/shared/db/measurements-storage";
import { getMeasurementMqttTopic } from "~/shared/measurements/measurement-topic";

// __DEV__-only seeding. Generates N fake measurements straight into the DB
// as "pending" and enqueues them, so the Outbox + Transport + retry paths
// can be exercised against a real burst without driving a physical device.

// Valid-uuid placeholders: these flow through the real ingest path and trip
// uuid validation downstream if malformed.
const DEV_EXPERIMENT_ID = "00000000-0000-0000-0000-000000000def";
const DEV_PROTOCOL_ID = "00000000-0000-0000-0000-0000000000d0";
const DEV_USER_ID = "00000000-0000-0000-0000-0000deadbeef";

// Seeded rows land in runs of 3 so the Recent list's collapsed workbook-run
// rows are exercised alongside the standalone ones.
const SEED_RUN_SIZE = 3;

function buildFakeMeasurement(index: number, workbookRunId: string): Measurement {
  const timestamp = new Date().toISOString();
  return {
    topic: getMeasurementMqttTopic({ experimentId: DEV_EXPERIMENT_ID }),
    measurementResult: {
      _dev_seed: true,
      _seed_index: index,
      workbook_run_id: workbookRunId,
      sample: [{ light_intensity: 1000 + index, leaf_temp: 22 + (index % 5) }],
      timestamp,
      user_id: DEV_USER_ID,
      protocol_id: DEV_PROTOCOL_ID,
      questions: [],
      macros: [],
      annotations: null,
    },
    metadata: {
      experimentName: `[DEV] Seeded burst ${new Date().toLocaleTimeString()}`,
      protocolName: "[DEV] Seed protocol",
      timestamp,
    },
  };
}

// Save in chunks, enqueue each chunk in one shot, then yield to the event loop:
// keeps the JS thread responsive (a 1000-row burst would otherwise freeze the
// UI), and one notify per chunk collapses N listeners into one React tick.
const SEED_CHUNK_SIZE = 50;

export async function devSeedMeasurements(count: number): Promise<number> {
  if (!__DEV__) {
    throw new Error("devSeedMeasurements may only run under __DEV__");
  }
  if (count <= 0) return 0;

  const outbox = getOutbox();
  let saved = 0;
  let runId = uuidv4();
  for (let chunkStart = 0; chunkStart < count; chunkStart += SEED_CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + SEED_CHUNK_SIZE, count);
    const ids: string[] = [];
    for (let index = chunkStart; index < chunkEnd; index++) {
      if (index % SEED_RUN_SIZE === 0) runId = uuidv4();
      const id = await saveMeasurement(buildFakeMeasurement(index, runId), "pending");
      ids.push(id);
      saved++;
    }
    outbox.enqueueMany(ids);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return saved;
}
