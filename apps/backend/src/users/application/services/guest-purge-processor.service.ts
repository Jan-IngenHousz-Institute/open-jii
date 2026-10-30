import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PurgeExpiredGuestsUseCase } from "../use-cases/purge-expired-guests/purge-expired-guests";

@Injectable()
export class GuestPurgeProcessorService {
  constructor(private readonly purge: PurgeExpiredGuestsUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: "UTC" })
  async purgeExpiredGuests(): Promise<void> {
    await this.purge.execute();
  }
}
