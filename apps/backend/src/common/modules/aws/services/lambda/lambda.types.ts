/**
 * Types for AWS Lambda invocation service
 */

export interface InvokeLambdaRequest {
  functionName: string;
  payload: Record<string, unknown>;
  invocationType?: "RequestResponse" | "Event";
}

export interface InvokeLambdaResponse {
  statusCode: number;
  payload: Record<string, unknown>;
  functionError?: string;
}

export interface LambdaConfig {
  region: string;
}
