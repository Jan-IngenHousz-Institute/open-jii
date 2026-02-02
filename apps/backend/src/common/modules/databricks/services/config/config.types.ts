import { z } from "zod";

export interface DatabricksConfig {
  host: string;
  clientId: string;
  clientSecret: string;
  ambyteProcessingJobId: string;
  enrichedTablesRefreshJobId: string;
  warehouseId: string;
  catalogName: string;
  centrumSchemaName: string;
  rawDataTableName: string;
  deviceDataTableName: string;
  rawAmbyteDataTableName: string;
  macroDataTableName: string;
}

export const databricksConfigSchema = z.object({
  host: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  ambyteProcessingJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Ambyte Processing Job ID must be numeric",
    }),
  enrichedTablesRefreshJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Enriched Tables Refresh Job ID must be numeric",
    }),
  warehouseId: z.string().min(1),
  catalogName: z.string().min(1),
  centrumSchemaName: z.string().min(1),
  rawDataTableName: z.string().min(1),
  deviceDataTableName: z.string().min(1),
  rawAmbyteDataTableName: z.string().min(1),
  macroDataTableName: z.string().min(1),
});
