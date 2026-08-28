import type { InvokeLambdaResponse } from "../../../common/modules/aws/services/lambda/lambda.types";
import type { Result } from "../../../common/utils/fp-utils";

export const CALIBRATION_SANDBOX_PORT = Symbol("CALIBRATION_SANDBOX_PORT");

export abstract class CalibrationSandboxPort {
  /**
   * Invoke the calibration sandbox Lambda synchronously with a run event
   * (script, captured series, parameters, output schema). The response shape
   * is the handler's; callers parse it with the model's response schema.
   */
  abstract invokeCalibrationSandbox<TResponse = Record<string, unknown>>(
    payload: object,
  ): Promise<Result<InvokeLambdaResponse<TResponse>>>;
}
