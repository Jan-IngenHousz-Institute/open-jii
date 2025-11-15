import { Module } from "@nestjs/common";

import { EmailConfigService } from "./config/config.service";
import { EmailAdapter } from "./email.adapter";
import { NotificationsService } from "./notifications/notifications.service";

@Module({
  imports: [],
  providers: [EmailAdapter, EmailConfigService, NotificationsService],
  exports: [EmailAdapter],
})
export class EmailModule {}
