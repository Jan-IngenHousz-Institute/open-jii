export type MqttErrorKind = "PublishError" | "Disconnected" | "Timeout" | "CredentialError";

export interface MqttErrorOptions {
  cause?: unknown;
}

export class MqttError extends Error {
  readonly kind: MqttErrorKind;

  constructor(kind: MqttErrorKind, message: string, options?: MqttErrorOptions) {
    super(message);
    // lib target (es2017) lacks the Error `cause` option, so set it manually.
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    this.kind = kind;
    this.name = `MqttError(${kind})`;
  }
}

export function isMqttError(err: unknown): err is MqttError {
  return err instanceof MqttError;
}

// Retryable from the Outbox's point of view. The Transport does no retry
// of its own; every retry attempt by the Outbox triggers a fresh lazy
// reconnect via Transport.ensureConnected(). The Outbox's [1, 4, 15]s
// backoff therefore *is* the reconnect schedule.
//
// CredentialError stays terminal: a Cognito misconfiguration won't be
// fixed by retrying inside the current attempt window, and burning the
// retry budget against AWS adds noise.
export function isRetryableMqttError(err: unknown): boolean {
  if (!isMqttError(err)) return true;
  switch (err.kind) {
    case "PublishError":
    case "Timeout":
    case "Disconnected":
      return true;
    case "CredentialError":
      return false;
  }
}
