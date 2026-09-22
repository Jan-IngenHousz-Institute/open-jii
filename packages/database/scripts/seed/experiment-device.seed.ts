import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { experiments, experimentDevices } from "../../src/schema";
import type { SeedDevice, SeedExperiment, SeedUser } from "./types";

/** Which device reports into which experiment. */
export async function seedExperimentDevices(
  user: SeedUser,
  createdDevices: SeedDevice[],
  createdExperiments: SeedExperiment[],
) {
  const ex = createdExperiments;
  // 9. Bind devices to experiments. Ambyte 01 also serves the archived
  // experiment: it shows the archived badge in the device's list, is excluded
  // from re-issued configs, and stays detachable.
  const d = createdDevices;
  const bindings = [
    { experimentId: ex[0].id, deviceId: d[0].id },
    { experimentId: ex[4].id, deviceId: d[0].id },
    { experimentId: ex[2].id, deviceId: d[0].id },
    { experimentId: ex[3].id, deviceId: d[2].id },
    { experimentId: ex[4].id, deviceId: d[4].id },
    { experimentId: ex[0].id, deviceId: d[5].id },
  ];

  await db
    .insert(experimentDevices)
    .values(bindings.map((binding) => ({ ...binding, addedBy: user.id })));
  console.log(`  Created ${bindings.length} experiment-device bindings`);
}
