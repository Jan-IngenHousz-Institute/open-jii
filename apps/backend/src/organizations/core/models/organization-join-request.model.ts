import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { joinRequestStatusEnum } from "@repo/database";
import { organizationJoinRequests } from "@repo/database";

export type OrganizationJoinRequestStatus = (typeof joinRequestStatusEnum.enumValues)[number];

export const organizationJoinRequestSchema = createSelectSchema(organizationJoinRequests)
  .omit({ userId: true })
  .extend({
    user: z.object({
      id: z.string().guid(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
  });

export type OrganizationJoinRequestDto = z.infer<typeof organizationJoinRequestSchema>;

export const DEMO_JOIN_APPROVAL_ERROR = {
  code: "DEMO_JOIN_REQUEST_APPROVAL_DISABLED",
  message: "Demo organizations do not accept join request approvals",
} as const;
