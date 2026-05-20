export type MqttErrorKind = "PublishError" | "Disconnected" | "Timeout" | "CredentialError";

export class MqttError extends Error {
  readonly kind: MqttErrorKind;

  constructor(kind: MqttErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.kind = kind;
    this.name = `MqttError(${kind})`;
  }
}

export function isMqttError(err: unknown): err is MqttError {
  return err instanceof MqttError;
}

// Retryable from the upload-queue's point of view. Disconnected publishes
// are NOT retryable here because the publisher already holds + retries them
// internally — by the time they surface, the publisher has given up.
export function isRetryableMqttError(err: unknown): boolean {
  if (!isMqttError(err)) return true;
  switch (err.kind) {
    case "PublishError":
    case "Timeout":
      return true;
    case "Disconnected":
    case "CredentialError":
      return false;
  }
}
