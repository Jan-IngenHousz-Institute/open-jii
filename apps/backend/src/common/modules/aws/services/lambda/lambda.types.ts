/**
 * Types for AWS Lambda invocation service
 */

export interface InvokeLambdaRequest {
  functionName: string;
  payload: object;
  invocationType?: "RequestResponse" | "Event";
  /** Sends the invoke to a local runtime interface emulator instead of AWS. */
  endpoint?: string;
}

export interface InvokeLambdaResponse<TPayload = Record<string, unknown>> {
  statusCode: number;
  payload: TPayload;
  functionError?: string;
}

export interface LambdaConfig {
  region: string;
}
