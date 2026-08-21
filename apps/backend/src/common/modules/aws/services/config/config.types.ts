import { z } from "zod";

export interface AwsConfig {
  region: string;
  placeIndexName: string;
  cognitoIdentityPoolId: string;
  cognitoDeveloperProviderName: string;
  iotPolicyNames: string[];
  iotJobsPolicyName: string;
  deviceThingTypeName: string;
  deviceThingGroupName: string;
  lambda: {
    macroSandboxPythonFunctionName: string;
    macroSandboxJavascriptFunctionName: string;
    macroSandboxRFunctionName: string;
  };
  s3: {
    iotArchiveBucketName: string;
    largeIotBucketName: string;
  };
}

export const awsConfigSchema = z.object({
  region: z.string().min(1),
  placeIndexName: z.string().min(1),
  cognitoIdentityPoolId: z.string().min(1),
  cognitoDeveloperProviderName: z.string().min(1),
  iotPolicyNames: z.array(z.string().min(1)).min(1),
  // Empty until the Jobs policy is applied in an environment; the attach is
  // skipped rather than failing credential issuance.
  iotJobsPolicyName: z.string(),
  deviceThingTypeName: z.string().min(1),
  deviceThingGroupName: z.string().min(1),
  lambda: z.object({
    macroSandboxPythonFunctionName: z.string().min(1),
    macroSandboxJavascriptFunctionName: z.string().min(1),
    macroSandboxRFunctionName: z.string().min(1),
  }),
  s3: z.object({
    iotArchiveBucketName: z.string().min(1),
    largeIotBucketName: z.string().min(1),
  }),
});
