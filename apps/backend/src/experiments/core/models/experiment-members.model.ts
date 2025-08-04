import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { experimentMembersEnum } from "@repo/database";
import { experimentMembers } from "@repo/database";

// Create schema for adding experiment members
export const addExperimentMemberSchema = createInsertSchema(experimentMembers)
  .omit({
    experimentId: true,
    joinedAt: true,
  })
  .extend({
    role: z.enum(["admin", "member"]).default("member").optional(),
  });
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

// Create schema for returning experiment members
export const experimentMemberSchema = createSelectSchema(experimentMembers)
  .omit({
    userId: true,
  })
  .extend({
    user: userSchema,
  });

export type U = z.infer<typeof userSchema>;
// DTOs
export type AddExperimentMemberDto = z.infer<typeof addExperimentMemberSchema>;
export type ExperimentMemberDto = z.infer<typeof experimentMemberSchema>;

// Define the role type based on the database enum
export type ExperimentMemberRole = (typeof experimentMembersEnum.enumValues)[number];
