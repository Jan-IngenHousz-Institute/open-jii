import { Injectable } from "@nestjs/common";

import type { NotificationPreference } from "@repo/api/domains/notification/notification.schema";

import { Result } from "../../../../common/utils/fp-utils";
import { NotificationPreferencesService } from "../../services/notification-preferences.service";

@Injectable()
export class GetNotificationPreferencesUseCase {
  constructor(private readonly notificationPreferences: NotificationPreferencesService) {}

  async execute(userId: string): Promise<Result<NotificationPreference[]>> {
    return this.notificationPreferences.resolve(userId);
  }
}
