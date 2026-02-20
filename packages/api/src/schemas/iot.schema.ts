import { z } from "zod";

// --- Iot Credentials ---
export const zIotCredentials = z.object({
  accessKeyId: z.string().describe("AWS Access Key ID for temporary credentials"),
  secretAccessKey: z.string().describe("AWS Secret Access Key for temporary credentials"),
  sessionToken: z.string().describe("AWS Session Token for temporary credentials"),
  expiration: z.string().datetime().describe("ISO 8601 date string when credentials expire"),
});

// --- Inferred types ---
export type IotCredentials = z.infer<typeof zIotCredentials>;
