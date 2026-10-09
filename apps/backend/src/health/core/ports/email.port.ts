import type { Result } from "../../../common/utils/fp-utils";

export const HEALTH_EMAIL_PORT = Symbol("HEALTH_EMAIL_PORT");

export interface EmailPort {
  verifyTransport(): Promise<Result<void>>;
}
