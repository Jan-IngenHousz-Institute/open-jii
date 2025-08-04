import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

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
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UserDto = z.infer<typeof selectUserSchema>;

// Define search parameters type
export interface SearchUsersParams {
  query?: string;
  limit?: number;
  offset?: number;
}
