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
    role: z.enum(["admin", "member"]).optional().default("member"),
  });

// Create schema for returning experiment members
export const experimentMemberSchema = createSelectSchema(
  experimentMembers,
).extend({
  user: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
});

// DTOs
export type AddExperimentMemberDto = typeof addExperimentMemberSchema._type;
export type ExperimentMemberDto = typeof experimentMemberSchema._type;

// Define the role type based on the database enum
export type ExperimentMemberRole =
  (typeof experimentMembersEnum.enumValues)[number];
