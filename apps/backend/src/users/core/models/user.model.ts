import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

import { profiles, users } from "@repo/database";

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
    avatarUrl: true,
    userId: true,
    organizationId: true,
    createdAt: true,
  })
  .extend({
    organization: z.string().optional(),
  });
export const selectUserProfileSchema = createSelectSchema(profiles)
  .omit({
    id: true,
    userId: true,
    organizationId: true,
  })
  .extend({
    organization: z.string().optional(),
  });

// Define the types
export type CreateUserDto = typeof createUserSchema._type;
export type UpdateUserDto = typeof updateUserSchema._type;
export type UserDto = typeof selectUserSchema._type;
export type CreateUserProfileDto = typeof createUserProfileSchema._type;
export type UserProfileDto = typeof selectUserProfileSchema._type;

// Define search parameters type
export interface SearchUsersParams {
  query?: string;
  limit?: number;
  offset?: number;
}
