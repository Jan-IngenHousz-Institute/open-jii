import { z } from "zod";

export const zErrorResponse = z.object({
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof zErrorResponse>;
