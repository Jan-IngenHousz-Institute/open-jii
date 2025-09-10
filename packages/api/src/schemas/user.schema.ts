import { z } from "zod";

export const zUser = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  emailVerified: z.string().datetime().nullable(),
  image: z.string().nullable(),
  createdAt: z.string().datetime(),
  registered: z.boolean(),
});

export const zUserList = z.array(zUser);

export const zSearchUsersQuery = z.object({
  query: z.string().optional().describe("Search query for name or email"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Maximum number of users to return"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("Number of users to skip for pagination"),
});

export const zCreateUserResponse = z.object({
  id: z.string().uuid(),
});

export const zCreateUserProfileBody = z.object({
  firstName: z.string().min(2).describe("First name"),
  lastName: z.string().min(2).describe("Last name"),
  bio: z.string().optional().describe("Bio"),
  organization: z.string().trim().optional().describe("Organization"),
});

export const zCreateUserProfileResponse = z.object({});

export const zUserProfile = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  bio: z.string().nullable(),
  organization: z.string().optional(),
  email: z.string().email().nullable(),
});

export const zUserProfileList = z.array(zUserProfile);

// Path parameters
export const zUserIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the user"),
});

// Infer types from Zod schemas
export type User = z.infer<typeof zUser>;
export type UserList = z.infer<typeof zUserList>;
export type UserProfileList = z.infer<typeof zUserProfileList>;
export type SearchUsersQuery = z.infer<typeof zSearchUsersQuery>;
export type UserIdPathParam = z.infer<typeof zUserIdPathParam>;
export type UserProfile = z.infer<typeof zUserProfile>;
export type CreateUserProfileBody = z.infer<typeof zCreateUserProfileBody>;
