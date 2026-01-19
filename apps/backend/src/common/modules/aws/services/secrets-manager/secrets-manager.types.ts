import { z } from "zod";

export const secretsManagerConfigSchema = z.object({
  region: z.string(),
  cacheTTL: z.number().default(300000), // 5 minutes default
});

export type SecretsManagerConfig = z.infer<typeof secretsManagerConfigSchema>;

export interface CachedSecret {
  value: Record<string, unknown>;
  fetchedAt: number;
}

export interface DatabaseCredentials {
  username: string;
  password: string;
}
