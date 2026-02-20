import type { InvokeLambdaResponse } from "../../../common/modules/aws/services/lambda/lambda.types";
import type { Result } from "../../../common/utils/fp-utils";

export const LAMBDA_PORT = Symbol("MACRO_LAMBDA_PORT");

export abstract class LambdaPort {
  /**
   * Invoke a Lambda function by name with an arbitrary JSON payload.
   * Domain consumers are responsible for constructing the payload
   * and interpreting the response.
   */
  abstract invokeLambda(
    functionName: string,
    payload: Record<string, unknown>,
  ): Promise<Result<InvokeLambdaResponse>>;

  /**
   * Resolve the Lambda function name for a given macro language.
   */
  abstract getFunctionNameForLanguage(language: "python" | "r" | "javascript"): string;
}
