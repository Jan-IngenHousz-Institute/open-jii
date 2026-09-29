import { Module } from "@nestjs/common";

// Services
import { NotificationPreferencesService } from "./application/services/notification-preferences.service";
// Use Cases
import { GetNotificationPreferencesUseCase } from "./application/use-cases/get-notification-preferences/get-notification-preferences";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count/get-unread-notification-count";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications/list-notifications";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read/mark-all-notifications-read";
import { MarkNotificationsReadUseCase } from "./application/use-cases/mark-notifications-read/mark-notifications-read";
import { UpdateNotificationPreferenceUseCase } from "./application/use-cases/update-notification-preference/update-notification-preference";
// Repositories
import { NotificationRepository } from "./core/repositories/notification.repository";
// Controllers
import { NotificationController } from "./presentation/notification.controller";

@Module({
  controllers: [NotificationController],
  providers: [
    // Repositories
    NotificationRepository,

    // Services
    NotificationPreferencesService,

    // Use cases
    ListNotificationsUseCase,
    GetUnreadNotificationCountUseCase,
    MarkNotificationsReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferenceUseCase,
  ],
})
export class NotificationModule {}
