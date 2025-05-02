import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { experimentMembers, experimentMembersEnum } from "@repo/database";

// Create schema for adding experiment members
export const addExperimentMemberSchema = createInsertSchema(experimentMembers)
  .omit({
    id: true,
    experimentId: true,
    joinedAt: true,
  })
  .extend({
    role: z.enum(["admin", "member"]).optional().default("member"),
  });

// Create schema for returning experiment members
export const experimentMemberSchema = createSelectSchema(experimentMembers);

// DTOs
export type AddExperimentMemberDto = typeof addExperimentMemberSchema._type;
export type ExperimentMemberDto = typeof experimentMemberSchema._type;

// Define the role type based on the database enum
export type ExperimentMemberRole =
  (typeof experimentMembersEnum.enumValues)[number];
