import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

import { profiles, users } from "@repo/database";

import type { ExperimentDto } from "../../../experiments/core/models/experiment.model";

// Create schemas for database operations
export const createUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export const updateUserSchema = createInsertSchema(users).partial().omit({
  id: true,
  createdAt: true,
});
export const selectUserSchema = createSelectSchema(users);
export const createUserProfileSchema = createInsertSchema(profiles)
  .omit({
    id: true,
    userId: true,
    organizationId: true,
    createdAt: true,
    whatsNewLastSeenAt: true,
  })
  .extend({
    organization: z.string().optional(),
    avatarUrl: z.string().nullable().optional(),
  });
export const selectUserProfileSchema = createSelectSchema(profiles)
  .omit({
    id: true,
    organizationId: true,
    whatsNewLastSeenAt: true,
  })
  .extend({
    organization: z.string().optional(),
    email: z.string().email().nullable(),
  });
export const userProfileMetadataSchema = createSelectSchema(profiles).pick({
  userId: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
});

// Define the types
export type CreateUserDto = typeof createUserSchema._type;
export type UpdateUserDto = typeof updateUserSchema._type;
export type UserDto = typeof selectUserSchema._type;
export type CreateUserProfileDto = typeof createUserProfileSchema._type;
export type UserProfileDto = typeof selectUserProfileSchema._type;
export type UserProfileMetadata = typeof userProfileMetadataSchema._type;

// Define search parameters type
export interface SearchUsersParams {
  query?: string;
  limit?: number;
  offset?: number;
}

// An experiment for which the user is the sole admin — i.e. a blocker for account deletion.
export type SoleAdminExperiment = Pick<ExperimentDto, "id" | "name" | "status">;

// A sole-admin experiment enriched with the other members who could take over admin before deletion.
export interface DeletionBlocker extends SoleAdminExperiment {
  candidates: UserProfileMetadata[];
}
