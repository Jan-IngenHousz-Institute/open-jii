import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "@repo/database";

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

// Define the types
export type CreateUserDto = typeof createUserSchema._type;
export type UpdateUserDto = typeof updateUserSchema._type;
export type UserDto = typeof selectUserSchema._type;

// Define search parameters type
export interface SearchUsersParams {
  query?: string;
  limit?: number;
  offset?: number;
}
