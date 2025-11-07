import { z } from "zod";

export interface DatabricksConfig {
  host: string;
  clientId: string;
  clientSecret: string;
  experimentProvisioningJobId: string;
  ambyteProcessingJobId: string;
  warehouseId: string;
  catalogName: string;
}

export const databricksConfigSchema = z.object({
  host: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  experimentProvisioningJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Experiment Provisioning Job ID must be numeric",
    }),
  ambyteProcessingJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Ambyte Processing Job ID must be numeric",
    }),
  warehouseId: z.string().min(1),
  catalogName: z.string().min(1),
});
