import { z } from "zod";

export interface DatabricksConfig {
  host: string;
  clientId: string;
  clientSecret: string;
  dataExportJobName: string;
  dataUploadJobName: string;
  warehouseId: string;
  catalogName: string;
  centrumSchemaName: string;
  metricsSchemaName: string;
  rawDataTableName: string;
  deviceDataTableName: string;
  macroDataTableName: string;
  uploadedDataTableName: string;
}

export const databricksConfigSchema = z.object({
  host: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  dataExportJobName: z.string().min(1),
  dataUploadJobName: z.string().min(1),
  warehouseId: z.string().min(1),
  catalogName: z.string().min(1),
  centrumSchemaName: z.string().min(1),
  metricsSchemaName: z.string().min(1),
  rawDataTableName: z.string().min(1),
  deviceDataTableName: z.string().min(1),
  macroDataTableName: z.string().min(1),
  uploadedDataTableName: z.string().min(1),
});
