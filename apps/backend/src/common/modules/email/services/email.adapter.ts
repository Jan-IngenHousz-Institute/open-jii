import { Injectable, Logger } from "@nestjs/common";

import { EmailPort } from "../../../../experiments/core/ports/email.port";
import { Result } from "../../../utils/fp-utils";
import { NotificationsService } from "./notifications/notifications.service";

@Injectable()
export class EmailAdapter implements EmailPort {
  private readonly logger = new Logger(EmailAdapter.name);

  constructor(private readonly notificationService: NotificationsService) {}

  async sendAddedUserNotification(
    experimentId: string,
    experimentName: string,
    actor: string,
    role: string,
    email: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending email notification",
      operation: "sendAddedUserNotification",
      context: EmailAdapter.name,
      experimentId,
      email,
    });

    return this.notificationService.sendAddedUserNotification(
      experimentId,
      experimentName,
      actor,
      role,
      email,
    );
  }

  async sendTransferRequestConfirmation(
    email: string,
    projectIdOld: string,
    projectUrlOld: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending transfer request confirmation",
      operation: "sendTransferRequestConfirmation",
      context: EmailAdapter.name,
      email,
      projectIdOld,
    });

    return this.notificationService.sendTransferRequestConfirmation(
      email,
      projectIdOld,
      projectUrlOld,
    );
  }
}
