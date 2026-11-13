import { Module } from "@nestjs/common";

import { ClientIpThrottlerGuard } from "../common/guards/client-ip-throttler.guard";
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { EmailModule } from "../common/modules/email/services/email.module";
// Services
import { NotificationDispatchService } from "./application/services/notification-dispatch.service";
import { NotificationEmailService } from "./application/services/notification-email.service";
import { NotificationOutboxMetricsService } from "./application/services/notification-outbox-metrics.service";
import { NotificationOutboxWorker } from "./application/services/notification-outbox.worker";
import { NotificationPreferencesService } from "./application/services/notification-preferences.service";
import { NotificationRetentionService } from "./application/services/notification-retention.service";
import { NotificationUnsubscribeService } from "./application/services/notification-unsubscribe.service";
import { ResourceDeletedNotifier } from "./application/services/resource-deleted-notifier";
// Use Cases
import { GetNotificationPreferencesUseCase } from "./application/use-cases/get-notification-preferences/get-notification-preferences";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count/get-unread-notification-count";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications/list-notifications";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read/mark-all-notifications-read";
import { MarkNotificationsReadUseCase } from "./application/use-cases/mark-notifications-read/mark-notifications-read";
import { SetEmailPreferenceByTokenUseCase } from "./application/use-cases/set-email-preference-by-token/set-email-preference-by-token";
import { UpdateNotificationPreferenceUseCase } from "./application/use-cases/update-notification-preference/update-notification-preference";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { NOTIFICATION_METRICS_PORT } from "./core/ports/metrics.port";
// Repositories
import { NotificationDeliveryRepository } from "./core/repositories/notification-delivery.repository";
import { NotificationRepository } from "./core/repositories/notification.repository";
// Controllers
import { NotificationUnsubscribeController } from "./presentation/notification-unsubscribe.controller";
import { NotificationController } from "./presentation/notification.controller";

@Module({
  imports: [EmailModule, AnalyticsModule, AwsModule],
  controllers: [NotificationController, NotificationUnsubscribeController],
  providers: [
    // Ports
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
    {
      provide: NOTIFICATION_METRICS_PORT,
      useExisting: AwsAdapter,
    },

    // Repositories
    NotificationRepository,
    NotificationDeliveryRepository,

    // Services
    NotificationDispatchService,
    NotificationEmailService,
    NotificationPreferencesService,
    NotificationOutboxWorker,
    NotificationOutboxMetricsService,
    NotificationRetentionService,
    ResourceDeletedNotifier,
    NotificationUnsubscribeService,

    // Use cases
    ListNotificationsUseCase,
    GetUnreadNotificationCountUseCase,
    MarkNotificationsReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferenceUseCase,
    SetEmailPreferenceByTokenUseCase,

    // Guards
    ClientIpThrottlerGuard,
  ],
  // Producers inject the dispatch service directly; it is an in-process domain
  // service, not infrastructure behind a port.
  exports: [NotificationDispatchService, ResourceDeletedNotifier],
})
export class NotificationModule {}
