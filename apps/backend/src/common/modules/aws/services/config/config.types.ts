import { z } from "zod";

export interface AwsConfig {
  region: string;
  placeIndexName: string;
  cognitoIdentityPoolId: string;
  cognitoDeveloperProviderName: string;
}

export const awsConfigSchema = z.object({
  region: z.string().min(1),
  placeIndexName: z.string().min(1),
  cognitoIdentityPoolId: z.string().min(1),
  cognitoDeveloperProviderName: z.string().min(1),
});
