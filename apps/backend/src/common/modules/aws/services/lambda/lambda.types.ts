/**
 * Types for AWS Lambda invocation service
 */

export interface InvokeLambdaRequest {
  functionName: string;
  payload: object;
  invocationType?: "RequestResponse" | "Event";
}

export interface InvokeLambdaResponse<TPayload = Record<string, unknown>> {
  statusCode: number;
  payload: TPayload;
  functionError?: string;
}

export interface LambdaConfig {
  region: string;
}
