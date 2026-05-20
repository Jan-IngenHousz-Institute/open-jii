import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { saveMeasurement, type Measurement } from "~/shared/db/measurements-storage";
import { getUploadQueue } from "./upload-queue";

// __DEV__-only seeding. Generates N fake measurements straight into the DB
// as "pending" and enqueues them, so the queue + publisher + retry paths
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

export async function devSeedMeasurements(count: number): Promise<number> {
  if (!__DEV__) {
    throw new Error("devSeedMeasurements may only run under __DEV__");
  }
  if (count <= 0) return 0;

  const queue = getUploadQueue();
  let saved = 0;
  for (let index = 0; index < count; index++) {
    const id = await saveMeasurement(buildFakeMeasurement(index), "pending");
    queue.enqueue(id);
    saved++;
  }
  return saved;
}
