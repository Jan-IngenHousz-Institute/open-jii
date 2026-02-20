import { z } from "zod";

export interface AwsConfig {
  region: string;
  placeIndexName: string;
  cognitoIdentityPoolId: string;
  cognitoDeveloperProviderName: string;
  lambda: {
    macroRunnerPythonFunctionName: string;
    macroRunnerJavascriptFunctionName: string;
    macroRunnerRFunctionName: string;
  };
}

export const awsConfigSchema = z.object({
  region: z.string().min(1),
  placeIndexName: z.string().min(1),
  cognitoIdentityPoolId: z.string().min(1),
  cognitoDeveloperProviderName: z.string().min(1),
  lambda: z.object({
    macroRunnerPythonFunctionName: z.string().min(1),
    macroRunnerJavascriptFunctionName: z.string().min(1),
    macroRunnerRFunctionName: z.string().min(1),
  }),
});
