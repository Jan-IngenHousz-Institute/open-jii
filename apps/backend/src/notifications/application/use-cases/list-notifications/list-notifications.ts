import { Injectable, Logger } from "@nestjs/common";

import {
  NOTIFICATION_TYPES,
  zNotificationType,
} from "@repo/api/domains/notification/notification.schema";
import type { NotificationCategory } from "@repo/api/domains/notification/notification.schema";

import { Result } from "../../../../common/utils/fp-utils";
import { NotificationDto } from "../../../core/models/notification.model";
import { NotificationRepository } from "../../../core/repositories/notification.repository";

export interface ListNotificationsInput {
  unreadOnly: boolean;
  category?: NotificationCategory;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListNotificationsUseCase {
  private readonly logger = new Logger(ListNotificationsUseCase.name);

  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(
    recipientId: string,
    input: ListNotificationsInput,
  ): Promise<Result<{ items: NotificationDto[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing notifications",
      operation: "listNotifications",
      recipientId,
      unreadOnly: input.unreadOnly,
      category: input.category,
    });

    const { category } = input;
    const types = category
      ? zNotificationType.options.filter((type) => NOTIFICATION_TYPES[type].category === category)
      : undefined;

    return this.notificationRepository.findPage(
      recipientId,
      { unreadOnly: input.unreadOnly, types },
      input.page,
      input.pageSize,
    );
  }
}
