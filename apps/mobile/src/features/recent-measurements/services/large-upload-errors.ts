import { isRetryableMqttError } from "~/features/connection/services/mqtt/mqtt-errors";

export type LargeUploadErrorKind =
  /** The stored topic carries no experiment id, so no upload URL can be minted. */
  | "NoExperiment"
  /** The signed-in user may not contribute to this experiment. */
  | "Forbidden"
  /** The experiment behind the stored topic is gone. */
  | "NotFound"
  /** The upload-url request or the PUT never reached a verdict. */
  | "Network"
  /** S3 answered the PUT with a status that is not success. */
  | "Rejected";

export interface LargeUploadErrorOptions {
  cause?: unknown;
}

export class LargeUploadError extends Error {
  readonly kind: LargeUploadErrorKind;
  /** Whether another attempt can plausibly succeed without the user acting. */
  readonly retryable: boolean;

  constructor(
    kind: LargeUploadErrorKind,
    message: string,
    retryable: boolean,
    options?: LargeUploadErrorOptions,
  ) {
    super(message);
    // lib target (es2017) lacks the Error `cause` option, so set it manually.
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    this.kind = kind;
    this.retryable = retryable;
    this.name = `LargeUploadError(${kind})`;
  }
}

export function isLargeUploadError(err: unknown): err is LargeUploadError {
  return err instanceof LargeUploadError;
}

/**
 * One retry verdict for both transports, so a row's status means the same thing
 * whichever way it travelled. The S3 path states its own verdict because its
 * terminal cases (membership, missing experiment) have no MQTT equivalent.
 */
export function isRetryableUploadError(err: unknown): boolean {
  if (isLargeUploadError(err)) return err.retryable;

  return isRetryableMqttError(err);
}
