import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { joinRequestStatusEnum } from "@repo/database";
import { experimentJoinRequests } from "@repo/database";

export type JoinRequestStatus = (typeof joinRequestStatusEnum.enumValues)[number];

export const experimentJoinRequestSchema = createSelectSchema(experimentJoinRequests)
  .omit({
    userId: true,
  })
  .extend({
    user: z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().nullable(),
    }),
  });

export type ExperimentJoinRequestDto = z.infer<typeof experimentJoinRequestSchema>;
