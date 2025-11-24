import { z } from "zod";

export interface EmailConfig {
  baseUrl: string;
  server: string;
  from: string;
}

export const emailConfigSchema = z.object({
  baseUrl: z.string().url(),
  server: z.string().url(),
  from: z.string().min(1),
});
