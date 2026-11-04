import { Injectable, Logger } from "@nestjs/common";

import type { EmailPreferenceByTokenResponse } from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../core/repositories/notification.repository";
import { NotificationUnsubscribeService } from "../../services/notification-unsubscribe.service";

@Injectable()
export class SetEmailPreferenceByTokenUseCase {
  private readonly logger = new Logger(SetEmailPreferenceByTokenUseCase.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationUnsubscribe: NotificationUnsubscribeService,
  ) {}

  async execute(token: string, enabled: boolean): Promise<Result<EmailPreferenceByTokenResponse>> {
    const verified = this.notificationUnsubscribe.verify(token);
    if (verified.isFailure()) {
      return verified;
    }
    const { userId, category, channel } = verified.value;

    this.logger.log({
      msg: "Setting email preference from an unsubscribe link",
      operation: "setEmailPreferenceByToken",
      userId,
      category,
      channel,
      enabled,
    });

    const saved = await this.notificationRepository.upsertPreference(
      userId,
      category,
      channel,
      enabled,
    );
    if (saved.isFailure()) {
      // The signature outlives the account; a deleted user must read the same as a bad link.
      if (saved.error.code === "REPOSITORY_REFERENCE") {
        return failure(
          AppError.badRequest(
            "Unsubscribe link is invalid or expired",
            ErrorCodes.NOTIFICATION_UNSUBSCRIBE_LINK_INVALID,
          ),
        );
      }
      return saved;
    }

    return success({ category });
  }
}
