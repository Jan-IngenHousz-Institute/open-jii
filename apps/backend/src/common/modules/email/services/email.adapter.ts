import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import type { EmailPort as HealthEmailPort } from "../../../../health/core/ports/email.port";
import { EmailPort as UsersEmailPort } from "../../../../users/core/ports/email.port";
import { Result } from "../../../utils/fp-utils";
import { NotificationsService } from "./notifications/notifications.service";
import type { NotificationEmailUnsubscribe } from "./notifications/notifications.service";

@Injectable()
export class EmailAdapter implements UsersEmailPort, HealthEmailPort {
  private readonly logger = new Logger(EmailAdapter.name);

  constructor(private readonly notificationService: NotificationsService) {}

  async sendAccessGrantedNotification(input: {
    resourceType: SharingResourceType;
    resourceId: string;
    resourceName: string;
    actor: string;
    role: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending access granted notification",
      operation: "sendAccessGrantedNotification",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });

    return this.notificationService.sendAccessGrantedNotification(input);
  }

  async sendResourceDeletedNotification(input: {
    resourceType: SharingResourceType;
    resourceName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }): Promise<Result<void>> {
    return this.notificationService.sendResourceDeletedNotification(input);
  }

  async sendExperimentMadePublicNotification(
    experimentId: string,
    experimentName: string,
    email: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    return this.notificationService.sendExperimentMadePublicNotification(
      experimentId,
      experimentName,
      email,
      unsubscribe,
    );
  }

  async sendCalibrationRunAwaitingApprovalNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
  }): Promise<Result<void>> {
    return this.notificationService.sendCalibrationRunAwaitingApprovalNotification(input);
  }

  async sendCalibrationRunApprovedNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
  }): Promise<Result<void>> {
    return this.notificationService.sendCalibrationRunApprovedNotification(input);
  }

  async sendCalibrationRunRejectedNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
  }): Promise<Result<void>> {
    return this.notificationService.sendCalibrationRunRejectedNotification(input);
  }

  async sendTransferRequestConfirmation(
    email: string,
    projectIdOld: string,
    projectUrlOld: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending transfer request confirmation",
      operation: "sendTransferRequestConfirmation",
      projectIdOld,
    });

    return this.notificationService.sendTransferRequestConfirmation(
      email,
      projectIdOld,
      projectUrlOld,
      unsubscribe,
    );
  }

  async sendInvitationEmail(input: {
    resourceType: "experiment";
    resourceId: string;
    resourceName: string;
    actor: string;
    role: string;
    email: string;
  }): Promise<Result<void>> {
    return this.notificationService.sendAccessGrantedNotification(input);
  }

  async sendProjectTransferComplete(
    email: string,
    experimentId: string,
    experimentName: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    return this.notificationService.sendProjectTransferComplete(
      email,
      experimentId,
      experimentName,
      unsubscribe,
    );
  }

  async sendJoinRequestSubmittedNotification(
    experimentId: string,
    experimentName: string,
    requesterName: string,
    adminEmail: string,
    message?: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending join request submitted notification",
      operation: "sendJoinRequestSubmittedNotification",
      experimentId,
    });

    return this.notificationService.sendJoinRequestSubmittedNotification(
      experimentId,
      experimentName,
      requesterName,
      adminEmail,
      message,
      unsubscribe,
    );
  }

  async sendJoinRequestRejectedNotification(
    experimentId: string,
    experimentName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending join request rejected notification",
      operation: "sendJoinRequestRejectedNotification",
      experimentId,
    });

    return this.notificationService.sendJoinRequestRejectedNotification(
      experimentId,
      experimentName,
      requesterEmail,
      unsubscribe,
    );
  }

  async sendOrganizationInvitationNotification(
    organizationId: string,
    organizationName: string,
    inviterName: string,
    role: string,
    recipientEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization invitation notification",
      operation: "sendOrganizationInvitationNotification",
      organizationId,
    });

    return this.notificationService.sendOrganizationInvitationNotification(
      organizationId,
      organizationName,
      inviterName,
      role,
      recipientEmail,
      unsubscribe,
    );
  }

  async sendOrganizationJoinRequestSubmittedNotification(
    organizationId: string,
    organizationName: string,
    requesterName: string,
    recipientEmail: string,
    message?: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request submitted notification",
      operation: "sendOrganizationJoinRequestSubmittedNotification",
      organizationId,
    });

    return this.notificationService.sendOrganizationJoinRequestSubmittedNotification(
      organizationId,
      organizationName,
      requesterName,
      recipientEmail,
      message,
      unsubscribe,
    );
  }

  async sendOrganizationJoinRequestApprovedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request approved notification",
      operation: "sendOrganizationJoinRequestApprovedNotification",
      organizationId,
    });

    return this.notificationService.sendOrganizationJoinRequestApprovedNotification(
      organizationId,
      organizationName,
      requesterEmail,
      unsubscribe,
    );
  }

  async sendOrganizationJoinRequestRejectedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization join request rejected notification",
      operation: "sendOrganizationJoinRequestRejectedNotification",
      organizationId,
    });

    return this.notificationService.sendOrganizationJoinRequestRejectedNotification(
      organizationId,
      organizationName,
      requesterEmail,
      unsubscribe,
    );
  }

  async sendOrganizationRoleChangedNotification(input: {
    organizationId: string;
    organizationName: string;
    actor: string;
    role: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization role changed notification",
      operation: "sendOrganizationRoleChangedNotification",
      organizationId: input.organizationId,
    });

    return this.notificationService.sendOrganizationRoleChangedNotification(input);
  }

  async sendOrganizationMembershipRemovedNotification(input: {
    organizationName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending organization membership removed notification",
      operation: "sendOrganizationMembershipRemovedNotification",
    });

    return this.notificationService.sendOrganizationMembershipRemovedNotification(input);
  }

  async sendApiKeyCreatedNotification(input: {
    keyName: string;
    email: string;
  }): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending API key created notification",
      operation: "sendApiKeyCreatedNotification",
    });

    return this.notificationService.sendApiKeyCreatedNotification(input);
  }

  async sendPasskeyAddedNotification(input: {
    passkeyName?: string;
    email: string;
  }): Promise<Result<void>> {
    this.logger.log({
      msg: "Sending passkey added notification",
      operation: "sendPasskeyAddedNotification",
    });

    return this.notificationService.sendPasskeyAddedNotification(input);
  }

  verifyTransport(): Promise<Result<void>> {
    return this.notificationService.verifyTransport();
  }
}
