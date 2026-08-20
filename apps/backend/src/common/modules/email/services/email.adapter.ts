import { Injectable, Logger } from "@nestjs/common";

import { EmailPort as ExperimentsEmailPort } from "../../../../experiments/core/ports/email.port";
import { OrganizationEmailPort } from "../../../../organizations/core/ports/email.port";
import { EmailPort as UsersEmailPort } from "../../../../users/core/ports/email.port";
import { Result } from "../../../utils/fp-utils";
import { NotificationsService } from "./notifications/notifications.service";

@Injectable()
export class EmailAdapter implements ExperimentsEmailPort, UsersEmailPort, OrganizationEmailPort {
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

  async sendProjectTransferComplete(
    email: string,
    experimentId: string,
    experimentName: string,
  ): Promise<Result<void>> {
    return this.notificationService.sendProjectTransferComplete(
      email,
      experimentId,
      experimentName,
    );
  }

  async sendJoinRequestSubmittedNotification(
    experimentId: string,
    experimentName: string,
    requesterName: string,
    adminEmail: string,
    message?: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending join request submitted notification",
      operation: "sendJoinRequestSubmittedNotification",
      experimentId,
      email: adminEmail,
    });

    return this.notificationService.sendJoinRequestSubmittedNotification(
      experimentId,
      experimentName,
      requesterName,
      adminEmail,
      message,
    );
  }

  async sendJoinRequestRejectedNotification(
    experimentId: string,
    experimentName: string,
    requesterEmail: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending join request rejected notification",
      operation: "sendJoinRequestRejectedNotification",
      experimentId,
      email: requesterEmail,
    });

    return this.notificationService.sendJoinRequestRejectedNotification(
      experimentId,
      experimentName,
      requesterEmail,
    );
  }

  async sendOrganizationJoinRequestSubmittedNotification(
    organizationId: string,
    organizationName: string,
    requesterName: string,
    recipientEmail: string,
    message?: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request submitted notification",
      operation: "sendOrganizationJoinRequestSubmittedNotification",
      organizationId,
      email: recipientEmail,
    });

    return this.notificationService.sendOrganizationJoinRequestSubmittedNotification(
      organizationId,
      organizationName,
      requesterName,
      recipientEmail,
      message,
    );
  }

  async sendOrganizationJoinRequestApprovedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request approved notification",
      operation: "sendOrganizationJoinRequestApprovedNotification",
      organizationId,
      email: requesterEmail,
    });

    return this.notificationService.sendOrganizationJoinRequestApprovedNotification(
      organizationId,
      organizationName,
      requesterEmail,
    );
  }

  async sendOrganizationJoinRequestRejectedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request rejected notification",
      operation: "sendOrganizationJoinRequestRejectedNotification",
      organizationId,
      email: requesterEmail,
    });

    return this.notificationService.sendOrganizationJoinRequestRejectedNotification(
      organizationId,
      organizationName,
      requesterEmail,
    );
  }
}
