import { z } from "zod";

export interface DatabricksConfig {
  host: string;
  clientId: string;
  clientSecret: string;
  jobId: string;
  warehouseId: string;
  catalogName: string;
}

export const databricksConfigSchema = z.object({
  host: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  jobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Job ID must be numeric",
    }),
  warehouseId: z.string().min(1),
  catalogName: z.string().min(1),
});
