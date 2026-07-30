import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
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
    createdAt: true,
    whatsNewLastSeenAt: true,
  })
  .extend({
    avatarUrl: z.string().nullable().optional(),
  });
export const selectUserProfileSchema = createSelectSchema(profiles)
  .omit({
    id: true,
    whatsNewLastSeenAt: true,
  })
  .extend({
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

// A resource for which the user is the sole admin — i.e. a blocker for account
// deletion. Any of the four shareable types can be one: each is created with a
// creator admin grant, so each can end up with exactly one named admin.
export interface SoleAdminResource {
  resourceType: SharingResourceType;
  id: string;
  name: string;
  // Only experiments carry a lifecycle status (the delete dialog badges it).
  status: ExperimentDto["status"] | null;
}

// A sole-admin resource enriched with the other grantees who could take over admin before deletion.
export interface DeletionBlocker extends SoleAdminResource {
  candidates: UserProfileMetadata[];
}
