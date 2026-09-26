import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { experimentJoinCodes } from "@repo/database";

export const experimentJoinCodeSchema = createSelectSchema(experimentJoinCodes);

export type ExperimentJoinCodeDto = z.infer<typeof experimentJoinCodeSchema>;
