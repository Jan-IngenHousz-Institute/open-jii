/**
 * Internal types for Lambda macro execution payloads.
 *
 * These types match the macro-runner Lambda handler event/response shapes.
 * Webhook request/response schemas live in @repo/api (macro.schema.ts).
 */

// ── Lambda payload shape, matching macro-runner handlers ──

export interface LambdaExecutionItem {
  id: string;
  data: Record<string, unknown>;
}

export interface LambdaExecutionPayload {
  script: string; // Base64-encoded macro script
  items: LambdaExecutionItem[];
  timeout: number;
}

export interface LambdaExecutionResultItem {
  id: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface LambdaExecutionResponse {
  status: "success" | "error";
  results: LambdaExecutionResultItem[];
  errors?: string[];
}
