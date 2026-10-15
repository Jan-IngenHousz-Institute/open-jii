import { z } from "zod";

/**
 * People lookup finds someone the caller already knows, it is not a directory to browse:
 * a short term matches too much and a large page lists too many. Shared by the global
 * user search and the sharing grantee picker so the two cannot drift apart.
 */
export const zPeopleSearchTerm = z
  .string()
  .trim()
  .min(2)
  .describe("Name, or a complete email address; at least 2 characters");

export const zPeopleSearchLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(20)
  .optional()
  .default(20)
  .describe("Maximum number of users to return");
