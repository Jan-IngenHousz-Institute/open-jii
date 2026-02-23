import { registerAs } from "@nestjs/config";

/**
 * AWS configuration values from environment variables
 */
export default registerAs("aws", () => ({
  region: process.env.AWS_REGION,
  location: {
    placeIndexName: process.env.AWS_LOCATION_PLACE_INDEX_NAME,
  },
  cognito: {
    identityPoolId: process.env.AWS_COGNITO_IDENTITY_POOL_ID,
    developerProviderName: process.env.AWS_COGNITO_DEVELOPER_PROVIDER_NAME,
  },
  lambda: {
    macroSandboxPythonFunctionName: process.env.AWS_LAMBDA_MACRO_SANDBOX_PYTHON_FUNCTION_NAME,
    macroSandboxJavascriptFunctionName:
      process.env.AWS_LAMBDA_MACRO_SANDBOX_JAVASCRIPT_FUNCTION_NAME,
    macroSandboxRFunctionName: process.env.AWS_LAMBDA_MACRO_SANDBOX_R_FUNCTION_NAME,
  },
}));
