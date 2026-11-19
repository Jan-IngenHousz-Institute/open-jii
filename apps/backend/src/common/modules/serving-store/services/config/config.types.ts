import { z } from "zod";

export interface ServingStoreConfig {
  url: string;
  username: string;
  password: string;
}

export const servingStoreConfigSchema = z.object({
  url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});
