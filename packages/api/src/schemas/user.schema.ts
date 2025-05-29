import { z } from "zod";

export const zUser = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  emailVerified: z.string().datetime().nullable(),
  image: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const zUserList = z.array(zUser);

export const zSearchUsersQuery = z.object({
  query: z.string().optional().describe("Search query for name or email"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .optional()
    .describe("Maximum number of users to return"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Number of users to skip for pagination"),
});

export const zCreateUserResponse = z.object({
  id: z.string().uuid(),
});

// Path parameters
export const zUserIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the user"),
});

// Infer types from Zod schemas
export type User = z.infer<typeof zUser>;
export type UserList = z.infer<typeof zUserList>;
export type SearchUsersQuery = z.infer<typeof zSearchUsersQuery>;
export type UserIdPathParam = z.infer<typeof zUserIdPathParam>;
