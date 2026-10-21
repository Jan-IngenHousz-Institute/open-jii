import { Inject, Injectable, Logger } from "@nestjs/common";

import type { GuestPurgeResult } from "../../../core/models/guest.model";
import { GUEST_PURGE_SIGNAL } from "../../../core/ports/guest-purge-signal.port";
import type { GuestPurgeSignal } from "../../../core/ports/guest-purge-signal.port";
import { GuestRepository } from "../../../core/repositories/guest.repository";

@Injectable()
export class PurgeExpiredGuestsUseCase {
  private readonly logger = new Logger(PurgeExpiredGuestsUseCase.name);

  constructor(
    private readonly guests: GuestRepository,
    @Inject(GUEST_PURGE_SIGNAL) private readonly signal: GuestPurgeSignal,
  ) {}

  async execute(now = new Date()): Promise<GuestPurgeResult | null> {
    try {
      const { blocked, ...result } = await this.guests.purgeExpired(now);
      for (const error of blocked) this.reportBlocked(error);
      this.logger.log({ msg: "Guest purge finished", operation: "purgeExpiredGuests", ...result });
      return result;
    } catch (error) {
      this.reportBlocked(error);
      return null;
    }
  }
  private reportBlocked(error: unknown) {
    const properties = {
      operation: "purgeExpiredGuests",
      error_code: "GUEST_PURGE_FAILED",
      $exception_fingerprint: "guest-purge:blocked",
    };
    this.logger.error({ msg: "Guest purge blocked; investigation required", ...properties });
    this.signal.report(error, properties);
  }
}
