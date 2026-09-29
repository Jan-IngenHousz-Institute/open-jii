import { Injectable } from "@nestjs/common";

import {
  NOTIFICATION_CATEGORIES,
  zNotificationCategory,
  zNotificationChannel,
} from "@repo/api/domains/notification/notification.schema";
import type { NotificationPreference } from "@repo/api/domains/notification/notification.schema";

import { Result, success } from "../../../common/utils/fp-utils";
import { NotificationRepository } from "../../core/repositories/notification.repository";

/**
 * A person's choice for every category and channel, saved or defaulted. Shared by the
 * settings read and write, and by whatever decides whether an event sends an email.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async resolve(userId: string): Promise<Result<NotificationPreference[]>> {
    const saved = await this.notificationRepository.findPreferences(userId);
    if (saved.isFailure()) {
      return saved;
    }

    const savedChoice = new Map(
      saved.value.map((row) => [`${row.category}:${row.channel}`, row.enabled]),
    );

    return success(
      zNotificationCategory.options.flatMap((category) =>
        zNotificationChannel.options.map((channel) => {
          const fallback = NOTIFICATION_CATEGORIES[category][channel];
          const enabled =
            fallback.locked || (savedChoice.get(`${category}:${channel}`) ?? fallback.enabled);
          return { category, channel, enabled, locked: fallback.locked };
        }),
      ),
    );
  }
}
