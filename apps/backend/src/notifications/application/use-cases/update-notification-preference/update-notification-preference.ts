import { Injectable, Logger } from "@nestjs/common";

import { NOTIFICATION_CATEGORIES } from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationPreference,
  UpdateNotificationPreferenceBody,
} from "@repo/api/domains/notification/notification.schema";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../core/repositories/notification.repository";
import { NotificationPreferencesService } from "../../services/notification-preferences.service";

@Injectable()
export class UpdateNotificationPreferenceUseCase {
  private readonly logger = new Logger(UpdateNotificationPreferenceUseCase.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  async execute(
    userId: string,
    preference: UpdateNotificationPreferenceBody,
  ): Promise<Result<NotificationPreference[]>> {
    this.logger.log({
      msg: "Updating notification preference",
      operation: "updateNotificationPreference",
      userId,
      category: preference.category,
      channel: preference.channel,
      enabled: preference.enabled,
    });

    if (NOTIFICATION_CATEGORIES[preference.category][preference.channel].locked) {
      return failure(
        AppError.badRequest(
          `${preference.category} cannot be turned off for ${preference.channel}`,
        ),
      );
    }

    const saved = await this.notificationRepository.upsertPreference(
      userId,
      preference.category,
      preference.channel,
      preference.enabled,
    );

    return saved.chain(() => this.notificationPreferences.resolve(userId));
  }
}
