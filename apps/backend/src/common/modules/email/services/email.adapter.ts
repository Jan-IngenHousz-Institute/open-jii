import { Injectable, Logger } from "@nestjs/common";

import { EmailPort as ExperimentsEmailPort } from "../../../../experiments/core/ports/email.port";
import { EmailPort as UsersEmailPort } from "../../../../users/core/ports/email.port";
import { Result } from "../../../utils/fp-utils";
import { NotificationsService } from "./notifications/notifications.service";

@Injectable()
export class EmailAdapter implements ExperimentsEmailPort, UsersEmailPort {
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
      email,
      projectIdOld,
    });

    return this.notificationService.sendTransferRequestConfirmation(
      email,
      projectIdOld,
      projectUrlOld,
    );
  }

  async sendInvitationEmail(
    resourceId: string,
    resourceName: string,
    actor: string,
    role: string,
    email: string,
  ): Promise<Result<void>> {
    return this.notificationService.sendAddedUserNotification(
      resourceId,
      resourceName,
      actor,
      role,
      email,
    );
  }
}
