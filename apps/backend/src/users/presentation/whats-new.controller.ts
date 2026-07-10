import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { handleFailure } from "../../common/utils/fp-utils";
import { GetWhatsNewSeenUseCase } from "../application/use-cases/get-whats-new-seen/get-whats-new-seen";
import { MarkWhatsNewSeenUseCase } from "../application/use-cases/mark-whats-new-seen/mark-whats-new-seen";

/**
 * "What's new" read-state endpoints. The backend only tracks when the caller last
 * opened the panel so the unread indicator can sync across devices — release-note content is
 * fetched directly from Contentful by the web/mobile clients.
 */
@Controller()
export class WhatsNewController {
  private readonly logger = new Logger(WhatsNewController.name);

  constructor(
    private readonly getWhatsNewSeenUseCase: GetWhatsNewSeenUseCase,
    private readonly markWhatsNewSeenUseCase: MarkWhatsNewSeenUseCase,
  ) {}

  @TsRestHandler(contract.users.getWhatsNewSeen)
  getLastSeen(@Session() session: UserSession) {
    return tsRestHandler(contract.users.getWhatsNewSeen, async () => {
      const result = await this.getWhatsNewSeenUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: { lastSeenAt: result.value ? result.value.toISOString() : null },
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.markWhatsNewSeen)
  markSeen(@Session() session: UserSession) {
    return tsRestHandler(contract.users.markWhatsNewSeen, async () => {
      const result = await this.markWhatsNewSeenUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "What's new marked as seen",
          operation: "markWhatsNewSeen",
          userId: session.user.id,
          status: "success",
        });
        return {
          status: StatusCodes.OK,
          body: { lastSeenAt: result.value ? result.value.toISOString() : null },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
