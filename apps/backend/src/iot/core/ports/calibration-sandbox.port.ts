import type { InvokeLambdaResponse } from "../../../common/modules/aws/services/lambda/lambda.types";
import type { Result } from "../../../common/utils/fp-utils";

export const CALIBRATION_SANDBOX_PORT = Symbol("CALIBRATION_SANDBOX_PORT");

export abstract class CalibrationSandboxPort {
  /** Invoke the calibration sandbox Lambda synchronously; callers parse the response with the model's schema. */
  abstract invokeCalibrationSandbox<TResponse = Record<string, unknown>>(
    payload: object,
  ): Promise<Result<InvokeLambdaResponse<TResponse>>>;
}
