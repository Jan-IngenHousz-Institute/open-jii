import { getOutbox } from "~/shared/composition/upload";
import { saveMeasurement } from "~/shared/db/measurements-storage";
import type { Measurement } from "~/shared/db/measurements-storage";
import { getMultispeqMqttTopic } from "~/shared/measurements/measurement-topic";

// __DEV__-only seeding. Generates N fake measurements straight into the DB
// as "pending" and enqueues them, so the Outbox + Transport + retry paths
// can be exercised against a real burst without driving a MultispeQ device.

const DEV_EXPERIMENT_ID = "00000000-0000-0000-0000-000000000dev";
const DEV_PROTOCOL_ID = "00000000-0000-0000-0000-0000000000d0";

function buildFakeMeasurement(index: number): Measurement {
  const timestamp = new Date().toISOString();
  return {
    topic: getMultispeqMqttTopic({
      experimentId: DEV_EXPERIMENT_ID,
      protocolId: DEV_PROTOCOL_ID,
    }),
    measurementResult: {
      _dev_seed: true,
      _seed_index: index,
      sample: [{ light_intensity: 1000 + index, leaf_temp: 22 + (index % 5) }],
      timestamp,
      user_id: "dev-user",
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

// Save in chunks, enqueue each chunk in one shot, then yield to the event
// loop. Two reasons: (1) keeps the JS thread responsive — without the yield
// a 1000-row burst monopolises it and the UI freezes; (2) one notify per
// chunk instead of per row collapses N×listeners React work into one tick.
const SEED_CHUNK_SIZE = 50;

export async function devSeedMeasurements(count: number): Promise<number> {
  if (!__DEV__) {
    throw new Error("devSeedMeasurements may only run under __DEV__");
  }
  if (count <= 0) return 0;

  const outbox = getOutbox();
  let saved = 0;
  for (let chunkStart = 0; chunkStart < count; chunkStart += SEED_CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + SEED_CHUNK_SIZE, count);
    const ids: string[] = [];
    for (let index = chunkStart; index < chunkEnd; index++) {
      const id = await saveMeasurement(buildFakeMeasurement(index), "pending");
      ids.push(id);
      saved++;
    }
    outbox.enqueueMany(ids);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return saved;
}
