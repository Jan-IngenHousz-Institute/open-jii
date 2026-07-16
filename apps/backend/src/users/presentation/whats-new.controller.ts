import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { userContract } from "@repo/api/domains/user/user.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetWhatsNewSeenUseCase } from "../application/use-cases/get-whats-new-seen/get-whats-new-seen";
import { MarkWhatsNewSeenUseCase } from "../application/use-cases/mark-whats-new-seen/mark-whats-new-seen";

/**
 * "What's new" read-state endpoints. The backend only tracks when the caller last
 * opened the panel so the unread indicator can sync across devices; release-note content is
 * fetched directly from Contentful by the web/mobile clients.
 */
@Controller()
export class WhatsNewController {
  private readonly logger = new Logger(WhatsNewController.name);

  constructor(
    private readonly getWhatsNewSeenUseCase: GetWhatsNewSeenUseCase,
    private readonly markWhatsNewSeenUseCase: MarkWhatsNewSeenUseCase,
  ) {}

  @Implement(userContract.getWhatsNewSeen)
  getLastSeen(@Session() session: UserSession) {
    return implement(userContract.getWhatsNewSeen).handler(async () => {
      const result = await this.getWhatsNewSeenUseCase.execute(session.user.id);
      if (result.isSuccess()) {
        return { lastSeenAt: result.value ? result.value.toISOString() : null };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userContract.markWhatsNewSeen)
  markSeen(@Session() session: UserSession) {
    return implement(userContract.markWhatsNewSeen).handler(async () => {
      const result = await this.markWhatsNewSeenUseCase.execute(session.user.id);
      if (result.isSuccess()) {
        this.logger.log({
          msg: "What's new marked as seen",
          operation: "markWhatsNewSeen",
          userId: session.user.id,
          status: "success",
        });
        return { lastSeenAt: result.value ? result.value.toISOString() : null };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
