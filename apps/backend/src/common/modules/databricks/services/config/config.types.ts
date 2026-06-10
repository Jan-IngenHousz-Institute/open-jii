import { z } from "zod";

export interface DatabricksConfig {
  host: string;
  clientId: string;
  clientSecret: string;
  dataExportJobId: string;
  dataUploadJobId: string;
  warehouseId: string;
  catalogName: string;
  centrumSchemaName: string;
  rawDataTableName: string;
  deviceDataTableName: string;
  macroDataTableName: string;
  uploadedDataTableName: string;
}

export const databricksConfigSchema = z.object({
  host: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  dataExportJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Data Export Job ID must be numeric",
    }),
  dataUploadJobId: z
    .string()
    .min(1)
    .refine((val) => !isNaN(Number(val)), {
      message: "Data Upload Job ID must be numeric",
    }),
  warehouseId: z.string().min(1),
  catalogName: z.string().min(1),
  centrumSchemaName: z.string().min(1),
  rawDataTableName: z.string().min(1),
  deviceDataTableName: z.string().min(1),
  macroDataTableName: z.string().min(1),
  uploadedDataTableName: z.string().min(1),
});
