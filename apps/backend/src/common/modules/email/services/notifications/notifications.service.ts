import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import type { EmailUnsubscribe } from "@repo/transactional/components/email-layout";
import { renderAccessGrantedNotification } from "@repo/transactional/render/access-granted-notification";
import { renderApiKeyCreatedNotification } from "@repo/transactional/render/api-key-created-notification";
import { renderCalibrationRunApprovedNotification } from "@repo/transactional/render/calibration-run-approved-notification";
import { renderCalibrationRunAwaitingApprovalNotification } from "@repo/transactional/render/calibration-run-awaiting-approval-notification";
import { renderCalibrationRunRejectedNotification } from "@repo/transactional/render/calibration-run-rejected-notification";
import { renderDataUploadCompletedNotification } from "@repo/transactional/render/data-upload-completed-notification";
import { renderDataUploadFailedNotification } from "@repo/transactional/render/data-upload-failed-notification";
import { renderDataUploadPartlyCompletedNotification } from "@repo/transactional/render/data-upload-partly-completed-notification";
import { renderExperimentMadePublicNotification } from "@repo/transactional/render/experiment-made-public-notification";
import { renderJoinRequestRejected } from "@repo/transactional/render/join-request-rejected";
import { renderJoinRequestSubmitted } from "@repo/transactional/render/join-request-submitted";
import { renderOrganizationInvitation } from "@repo/transactional/render/organization-invitation";
import { renderOrganizationJoinRequestApproved } from "@repo/transactional/render/organization-join-request-approved";
import { renderOrganizationJoinRequestRejected } from "@repo/transactional/render/organization-join-request-rejected";
import { renderOrganizationJoinRequestSubmitted } from "@repo/transactional/render/organization-join-request-submitted";
import { renderOrganizationMembershipRemoved } from "@repo/transactional/render/organization-membership-removed";
import { renderOrganizationRoleChanged } from "@repo/transactional/render/organization-role-changed";
import { renderPasskeyAddedNotification } from "@repo/transactional/render/passkey-added-notification";
import { renderProjectTransferComplete } from "@repo/transactional/render/project-transfer-complete";
import { renderResourceDeletedNotification } from "@repo/transactional/render/resource-deleted-notification";
import { renderTransferRequestConfirmation } from "@repo/transactional/render/transfer-request-confirmation";

import { ErrorCodes } from "../../../../utils/error-codes";
import { apiErrorMapper, AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { EmailConfigService } from "../config/config.service";

/**
 * Where each shareable resource lives under `/platform` in the web app. Total over
 * `SharingResourceType` deliberately: a new shareable type fails to compile here
 * rather than emailing a link that 404s. The web keeps its own copy for the bell,
 * which also knows organizations.
 */
const RESOURCE_PAGE_SEGMENT: Record<SharingResourceType, string> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
  device: "devices",
  device_group: "devices/groups",
  calibration_definition: "calibrations",
};

/** What the email calls each resource in its body: "access to the {kind} {name}". */
const RESOURCE_KIND_LABEL: Record<SharingResourceType, string> = {
  experiment: "experiment",
  macro: "macro",
  protocol: "protocol",
  workbook: "workbook",
  device: "device",
  device_group: "device group",
  calibration_definition: "calibration definition",
};

/**
 * Every one of these must stay well under the outbox worker's lease. The lease hands
 * a row to another task once a claim is older than it, on the premise that no send
 * takes that long; nodemailer's own defaults are longer (ten minutes of socket
 * inactivity), so without these a stalled socket lets a second task send the same
 * email while the first is still waiting on it.
 */
export const MAIL_TRANSPORT_TIMEOUTS_MS = {
  connectionTimeout: 30_000,
  greetingTimeout: 30_000,
  socketTimeout: 60_000,
} as const;

/**
 * The nodemailer error codes that mean the relay could not be reached at all — no
 * connection, no greeting, a socket that died or a name that would not resolve — as
 * opposed to a relay that answered and refused the message. These are nodemailer's own
 * transient set (`ETIMEDOUT`, `ESOCKET`, `ECONNECTION`, which also covers a relay that
 * greets with 421 and closes) plus `EDNS`. `ETLS` and `EAUTH` are left out on purpose:
 * a certificate or a credential that is wrong stays wrong, and has to surface as a
 * failure rather than wait forever as an outage.
 */
const RELAY_UNREACHABLE_CODES: ReadonlySet<string> = new Set([
  "ECONNECTION",
  "ETIMEDOUT",
  "ESOCKET",
  "EDNS",
]);

/**
 * The timeouts have to travel in `createTransport`'s first argument, beside the url:
 * its second argument is per-message defaults, which would take them without complaint
 * and leave the connection on nodemailer's own ten-minute socket default.
 */
export const mailTransportOptions = (url: string) => ({ url, ...MAIL_TRANSPORT_TIMEOUTS_MS });

export type NotificationEmailUnsubscribe = EmailUnsubscribe & { oneClickUrl: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly emailConfigService: EmailConfigService) {}

  /* v8 ignore next 3 */
  protected createMailTransport(serverConfig: string) {
    return createTransport(mailTransportOptions(serverConfig));
  }

  /* v8 ignore next 5 */
  protected renderAccessGrantedNotificationEmail(
    ...args: Parameters<typeof renderAccessGrantedNotification>
  ) {
    return renderAccessGrantedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderResourceDeletedNotificationEmail(
    ...args: Parameters<typeof renderResourceDeletedNotification>
  ) {
    return renderResourceDeletedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderExperimentMadePublicNotificationEmail(
    ...args: Parameters<typeof renderExperimentMadePublicNotification>
  ) {
    return renderExperimentMadePublicNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderCalibrationRunAwaitingApprovalNotificationEmail(
    ...args: Parameters<typeof renderCalibrationRunAwaitingApprovalNotification>
  ) {
    return renderCalibrationRunAwaitingApprovalNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderCalibrationRunApprovedNotificationEmail(
    ...args: Parameters<typeof renderCalibrationRunApprovedNotification>
  ) {
    return renderCalibrationRunApprovedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderCalibrationRunRejectedNotificationEmail(
    ...args: Parameters<typeof renderCalibrationRunRejectedNotification>
  ) {
    return renderCalibrationRunRejectedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderDataUploadCompletedNotificationEmail(
    ...args: Parameters<typeof renderDataUploadCompletedNotification>
  ) {
    return renderDataUploadCompletedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderDataUploadFailedNotificationEmail(
    ...args: Parameters<typeof renderDataUploadFailedNotification>
  ) {
    return renderDataUploadFailedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderDataUploadPartlyCompletedNotificationEmail(
    ...args: Parameters<typeof renderDataUploadPartlyCompletedNotification>
  ) {
    return renderDataUploadPartlyCompletedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderTransferRequestConfirmationEmail(
    ...args: Parameters<typeof renderTransferRequestConfirmation>
  ) {
    return renderTransferRequestConfirmation(...args);
  }

  /* v8 ignore next 5 */
  protected renderProjectTransferCompleteEmail(
    ...args: Parameters<typeof renderProjectTransferComplete>
  ) {
    return renderProjectTransferComplete(...args);
  }

  /* v8 ignore next 5 */
  protected renderJoinRequestSubmittedEmail(
    ...args: Parameters<typeof renderJoinRequestSubmitted>
  ) {
    return renderJoinRequestSubmitted(...args);
  }

  /* v8 ignore next 5 */
  protected renderJoinRequestRejectedEmail(...args: Parameters<typeof renderJoinRequestRejected>) {
    return renderJoinRequestRejected(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationInvitationEmail(
    ...args: Parameters<typeof renderOrganizationInvitation>
  ) {
    return renderOrganizationInvitation(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationJoinRequestSubmittedEmail(
    ...args: Parameters<typeof renderOrganizationJoinRequestSubmitted>
  ) {
    return renderOrganizationJoinRequestSubmitted(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationJoinRequestApprovedEmail(
    ...args: Parameters<typeof renderOrganizationJoinRequestApproved>
  ) {
    return renderOrganizationJoinRequestApproved(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationJoinRequestRejectedEmail(
    ...args: Parameters<typeof renderOrganizationJoinRequestRejected>
  ) {
    return renderOrganizationJoinRequestRejected(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationRoleChangedEmail(
    ...args: Parameters<typeof renderOrganizationRoleChanged>
  ) {
    return renderOrganizationRoleChanged(...args);
  }

  /* v8 ignore next 5 */
  protected renderOrganizationMembershipRemovedEmail(
    ...args: Parameters<typeof renderOrganizationMembershipRemoved>
  ) {
    return renderOrganizationMembershipRemoved(...args);
  }

  /* v8 ignore next 5 */
  protected renderApiKeyCreatedNotificationEmail(
    ...args: Parameters<typeof renderApiKeyCreatedNotification>
  ) {
    return renderApiKeyCreatedNotification(...args);
  }

  /* v8 ignore next 5 */
  protected renderPasskeyAddedNotificationEmail(
    ...args: Parameters<typeof renderPasskeyAddedNotification>
  ) {
    return renderPasskeyAddedNotification(...args);
  }

  // Logs in to the SMTP server without sending anything.
  async verifyTransport(): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.createMailTransport(this.emailConfigService.getServer()).verify();
      },
      (error) =>
        AppError.internal(
          `SMTP check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ErrorCodes.EMAIL_TRANSPORT_VERIFY_FAILED,
        ),
    );
  }

  /**
   * Hand a rendered email to the transport and treat any address it rejected or
   * left pending as a failure — a partially delivered send is not a success.
   */
  private async dispatch(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }): Promise<void> {
    const transport = this.createMailTransport(this.emailConfigService.getServer());

    const result = await transport.sendMail({
      to: params.to,
      from: { name: "openJII", address: this.emailConfigService.getFrom() },
      subject: params.subject,
      html: params.html,
      text: params.text,
      // RFC 8058: the mail client's own unsubscribe button posts once to the URL, with no page in between.
      headers: params.unsubscribe && {
        "List-Unsubscribe": `<${params.unsubscribe.oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    const rejected: (string | Mail.Address)[] = result.rejected;
    const pending: (string | Mail.Address)[] = result.pending ?? [];
    const failed: (string | Mail.Address)[] = rejected.concat(pending).filter(Boolean);

    if (failed.length > 0) {
      throw new Error("Email could not be sent");
    }
  }

  /**
   * What a send that threw becomes, logged once at the level it deserves. A relay that
   * could not be reached at all gets its own code, so a caller can wait out the outage
   * instead of spending an attempt on it, and it is a warning: every send during an
   * outage fails the same way, and none of them is the email's fault. Anything else
   * keeps the mapping and the error level every send has always had. The message is
   * the same either way.
   */
  private sendFailure(error: unknown, log: Record<string, unknown>): AppError {
    const message = `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`;
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

    if (typeof code === "string" && RELAY_UNREACHABLE_CODES.has(code)) {
      this.logger.warn(log);
      return AppError.internal(message, ErrorCodes.EMAIL_RELAY_UNREACHABLE);
    }

    this.logger.error({ ...log, errorCode: ErrorCodes.EMAIL_SEND_FAILED });
    return apiErrorMapper(message);
  }

  /** Where an organization lives in the web app — the link every org email points at. */
  private organizationUrl(organizationId: string): { host: string; url: string; baseUrl: string } {
    const baseUrl = this.emailConfigService.getBaseUrl();
    const { host } = new URL(baseUrl);
    const { href } = new URL(`/platform/organizations/${organizationId}`, baseUrl);
    return { host, url: href, baseUrl };
  }

  /**
   * The invitation email for an invitee who already has an account — the same
   * `@repo/transactional` template and the same destination `packages/auth` uses for
   * an invitee who does not, so the two halves of the split read identically. The
   * link is the account tab listing every invitation waiting for the address signed
   * in with, not a per-invitation route: an id belonging to another address could
   * only ever be refused.
   */
  async sendOrganizationInvitationNotification(
    organizationId: string,
    organizationName: string,
    inviterName: string,
    role: string,
    recipientEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: inviteUrl } = new URL("/platform/account/invitations", baseUrl);

        const { html, text } = await this.renderOrganizationInvitationEmail({
          host,
          organizationName,
          inviteUrl,
          inviterName,
          role,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: recipientEmail,
          subject: `You've been invited to join ${organizationName}`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization invitation notification sent",
          operation: "sendOrganizationInvitationNotification",
          organizationId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization invitation notification",
          operation: "sendOrganizationInvitationNotification",
          organizationId,
          error,
        }),
    );
  }

  async sendOrganizationJoinRequestSubmittedNotification(
    organizationId: string,
    organizationName: string,
    requesterName: string,
    recipientEmail: string,
    message?: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        const { host, url, baseUrl } = this.organizationUrl(organizationId);
        const { html, text } = await this.renderOrganizationJoinRequestSubmittedEmail({
          host,
          organizationName,
          organizationUrl: url,
          requesterName,
          message,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: recipientEmail,
          subject: `New request to join ${organizationName} on openJII`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization join request submitted notification sent",
          operation: "sendOrganizationJoinRequestSubmittedNotification",
          organizationId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization join request submitted notification",
          operation: "sendOrganizationJoinRequestSubmittedNotification",
          organizationId,
          error,
        }),
    );
  }

  async sendOrganizationJoinRequestApprovedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        const { host, url, baseUrl } = this.organizationUrl(organizationId);
        const { html, text } = await this.renderOrganizationJoinRequestApprovedEmail({
          host,
          organizationName,
          organizationUrl: url,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: requesterEmail,
          subject: `You have joined ${organizationName} on openJII`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization join request approved notification sent",
          operation: "sendOrganizationJoinRequestApprovedNotification",
          organizationId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization join request approved notification",
          operation: "sendOrganizationJoinRequestApprovedNotification",
          organizationId,
          error,
        }),
    );
  }

  async sendOrganizationJoinRequestRejectedNotification(
    organizationId: string,
    organizationName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        const { host, baseUrl } = this.organizationUrl(organizationId);
        const { html, text } = await this.renderOrganizationJoinRequestRejectedEmail({
          host,
          organizationName,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: requesterEmail,
          subject: `Update on your request to join ${organizationName}`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization join request rejected notification sent",
          operation: "sendOrganizationJoinRequestRejectedNotification",
          organizationId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization join request rejected notification",
          operation: "sendOrganizationJoinRequestRejectedNotification",
          organizationId,
          error,
        }),
    );
  }

  async sendOrganizationRoleChangedNotification(input: {
    organizationId: string;
    organizationName: string;
    actor: string;
    role: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { organizationId, organizationName, actor, role, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        const { host, url, baseUrl } = this.organizationUrl(organizationId);
        const { html, text } = await this.renderOrganizationRoleChangedEmail({
          host,
          baseUrl,
          organizationName,
          organizationUrl: url,
          actor,
          role,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your role in ${organizationName} changed on the openJII Platform`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization role changed notification sent",
          operation: "sendOrganizationRoleChangedNotification",
          organizationId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization role changed notification",
          operation: "sendOrganizationRoleChangedNotification",
          organizationId,
          error,
        }),
    );
  }

  async sendOrganizationMembershipRemovedNotification(input: {
    organizationName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { organizationName, actor, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { html, text } = await this.renderOrganizationMembershipRemovedEmail({
          host,
          baseUrl,
          organizationName,
          actor,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `You were removed from ${organizationName} on the openJII Platform`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Organization membership removed notification sent",
          operation: "sendOrganizationMembershipRemovedNotification",
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send organization membership removed notification",
          operation: "sendOrganizationMembershipRemovedNotification",
          error,
        }),
    );
  }

  /**
   * The one email for being given access to anything — a direct share, an approved
   * join request or an invitation by address — whatever the resource.
   */
  async sendAccessGrantedNotification(input: {
    resourceType: SharingResourceType;
    resourceId: string;
    resourceName: string;
    actor: string;
    role: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { resourceType, resourceId, resourceName, actor, role, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending access granted notification email",
          operation: "sendAccessGrantedNotification",
          role,
          resourceType,
          resourceId,
          actor,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: resourceUrl } = new URL(
          `/platform/${RESOURCE_PAGE_SEGMENT[resourceType]}/${resourceId}`,
          baseUrl,
        );

        const { html, text } = await this.renderAccessGrantedNotificationEmail({
          host,
          baseUrl,
          resourceKind: RESOURCE_KIND_LABEL[resourceType],
          resourceName,
          resourceUrl,
          actor,
          role,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Access to ${resourceName} on the openJII Platform`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Access granted notification email sent successfully",
          operation: "sendAccessGrantedNotification",
          resourceType,
          resourceId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send access granted notification email",
          operation: "sendAccessGrantedNotification",
          resourceType,
          resourceId,
          error,
        }),
    );
  }

  async sendResourceDeletedNotification(input: {
    resourceType: SharingResourceType;
    resourceName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { resourceType, resourceName, actor, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending resource deleted notification email",
          operation: "sendResourceDeletedNotification",
          resourceType,
          actor,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);

        const { html, text } = await this.renderResourceDeletedNotificationEmail({
          host,
          baseUrl,
          resourceKind: RESOURCE_KIND_LABEL[resourceType],
          resourceName,
          actor,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `${resourceName} was deleted on the openJII Platform`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Resource deleted notification email sent successfully",
          operation: "sendResourceDeletedNotification",
          resourceType,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send resource deleted notification email",
          operation: "sendResourceDeletedNotification",
          resourceType,
          error,
        }),
    );
  }

  async sendExperimentMadePublicNotification(
    experimentId: string,
    experimentName: string,
    email: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending experiment made public notification email",
          operation: "sendExperimentMadePublicNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: experimentUrl } = new URL(`/platform/experiments/${experimentId}`, baseUrl);

        const { html, text } = await this.renderExperimentMadePublicNotificationEmail({
          host,
          baseUrl,
          experimentName,
          experimentUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `${experimentName} is now public on the openJII Platform`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Experiment made public notification email sent successfully",
          operation: "sendExperimentMadePublicNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send experiment made public notification email",
          operation: "sendExperimentMadePublicNotification",
          experimentId,
          error,
        }),
    );
  }

  async sendApiKeyCreatedNotification(input: { keyName: string; email: string }) {
    const { keyName, email } = input;

    return await tryCatch(
      async () => {
        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: apiKeysUrl } = new URL("/platform/account/api-keys", baseUrl);

        const { html, text } = await this.renderApiKeyCreatedNotificationEmail({
          host,
          baseUrl,
          keyName,
          apiKeysUrl,
        });

        await this.dispatch({
          to: email,
          subject: "A new API key was added to your openJII account",
          html,
          text,
        });

        this.logger.log({
          msg: "API key created notification sent",
          operation: "sendApiKeyCreatedNotification",
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send API key created notification",
          operation: "sendApiKeyCreatedNotification",
          error,
        }),
    );
  }

  async sendPasskeyAddedNotification(input: { passkeyName?: string; email: string }) {
    const { passkeyName, email } = input;

    return await tryCatch(
      async () => {
        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: securityUrl } = new URL("/platform/account/security", baseUrl);

        const { html, text } = await this.renderPasskeyAddedNotificationEmail({
          host,
          baseUrl,
          passkeyName,
          securityUrl,
        });

        await this.dispatch({
          to: email,
          subject: "A new passkey was added to your openJII account",
          html,
          text,
        });

        this.logger.log({
          msg: "Passkey added notification sent",
          operation: "sendPasskeyAddedNotification",
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send passkey added notification",
          operation: "sendPasskeyAddedNotification",
          error,
        }),
    );
  }

  async sendCalibrationRunAwaitingApprovalNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { deviceId, deviceName, definitionName, actor, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending calibration run awaiting approval notification email",
          operation: "sendCalibrationRunAwaitingApprovalNotification",
          deviceId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: calibrationUrl } = new URL(
          `/platform/devices/${deviceId}/calibration`,
          baseUrl,
        );

        const { html, text } = await this.renderCalibrationRunAwaitingApprovalNotificationEmail({
          host,
          baseUrl,
          deviceName,
          definitionName,
          actor,
          calibrationUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `A ${definitionName} calibration of ${deviceName} is waiting for approval`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Calibration run awaiting approval notification email sent successfully",
          operation: "sendCalibrationRunAwaitingApprovalNotification",
          deviceId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send calibration run awaiting approval notification email",
          operation: "sendCalibrationRunAwaitingApprovalNotification",
          deviceId,
          error,
        }),
    );
  }

  async sendCalibrationRunApprovedNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { deviceId, deviceName, definitionName, actor, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending calibration run approved notification email",
          operation: "sendCalibrationRunApprovedNotification",
          deviceId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: calibrationUrl } = new URL(
          `/platform/devices/${deviceId}/calibration`,
          baseUrl,
        );

        const { html, text } = await this.renderCalibrationRunApprovedNotificationEmail({
          host,
          baseUrl,
          deviceName,
          definitionName,
          actor,
          calibrationUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your ${definitionName} calibration of ${deviceName} was approved`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Calibration run approved notification email sent successfully",
          operation: "sendCalibrationRunApprovedNotification",
          deviceId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send calibration run approved notification email",
          operation: "sendCalibrationRunApprovedNotification",
          deviceId,
          error,
        }),
    );
  }

  async sendCalibrationRunRejectedNotification(input: {
    deviceId: string;
    deviceName: string;
    definitionName: string;
    actor: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { deviceId, deviceName, definitionName, actor, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending calibration run rejected notification email",
          operation: "sendCalibrationRunRejectedNotification",
          deviceId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: calibrationUrl } = new URL(
          `/platform/devices/${deviceId}/calibration`,
          baseUrl,
        );

        const { html, text } = await this.renderCalibrationRunRejectedNotificationEmail({
          host,
          baseUrl,
          deviceName,
          definitionName,
          actor,
          calibrationUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your ${definitionName} calibration of ${deviceName} was rejected`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Calibration run rejected notification email sent successfully",
          operation: "sendCalibrationRunRejectedNotification",
          deviceId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send calibration run rejected notification email",
          operation: "sendCalibrationRunRejectedNotification",
          deviceId,
          error,
        }),
    );
  }

  async sendDataUploadCompletedNotification(input: {
    experimentId: string;
    experimentName: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { experimentId, experimentName, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending data upload completed notification email",
          operation: "sendDataUploadCompletedNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: dataUrl } = new URL(`/platform/experiments/${experimentId}/data`, baseUrl);

        const { html, text } = await this.renderDataUploadCompletedNotificationEmail({
          host,
          baseUrl,
          experimentName,
          dataUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your upload to ${experimentName} is ready to query`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Data upload completed notification email sent successfully",
          operation: "sendDataUploadCompletedNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send data upload completed notification email",
          operation: "sendDataUploadCompletedNotification",
          experimentId,
          error,
        }),
    );
  }

  async sendDataUploadPartlyCompletedNotification(input: {
    experimentId: string;
    experimentName: string;
    skippedCount: string;
    skippedFiles: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { experimentId, experimentName, skippedCount, skippedFiles, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending data upload partly completed notification email",
          operation: "sendDataUploadPartlyCompletedNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: dataUrl } = new URL(`/platform/experiments/${experimentId}/data`, baseUrl);

        const { html, text } = await this.renderDataUploadPartlyCompletedNotificationEmail({
          host,
          baseUrl,
          experimentName,
          skippedCount,
          skippedFiles,
          dataUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your upload to ${experimentName} is ready to query, with files left out`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Data upload partly completed notification email sent successfully",
          operation: "sendDataUploadPartlyCompletedNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send data upload partly completed notification email",
          operation: "sendDataUploadPartlyCompletedNotification",
          experimentId,
          error,
        }),
    );
  }

  async sendDataUploadFailedNotification(input: {
    experimentId: string;
    experimentName: string;
    tableName: string;
    email: string;
    unsubscribe?: NotificationEmailUnsubscribe;
  }) {
    const { experimentId, experimentName, tableName, email, unsubscribe } = input;

    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending data upload failed notification email",
          operation: "sendDataUploadFailedNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: dataUrl } = new URL(`/platform/experiments/${experimentId}/data`, baseUrl);

        const { html, text } = await this.renderDataUploadFailedNotificationEmail({
          host,
          baseUrl,
          experimentName,
          tableName,
          dataUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Your upload to ${tableName} in ${experimentName} failed`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Data upload failed notification email sent successfully",
          operation: "sendDataUploadFailedNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send data upload failed notification email",
          operation: "sendDataUploadFailedNotification",
          experimentId,
          error,
        }),
    );
  }

  async sendTransferRequestConfirmation(
    email: string,
    projectIdOld: string,
    projectUrlOld: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending transfer request confirmation email",
          operation: "sendTransferRequestConfirmation",
          projectId: projectIdOld,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);

        const { html, text } = await this.renderTransferRequestConfirmationEmail({
          host,
          projectIdOld,
          projectUrlOld,
          userEmail: email,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Project Transfer Request Received - openJII`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Transfer request confirmation email sent successfully",
          operation: "sendTransferRequestConfirmation",
          projectId: projectIdOld,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send transfer request confirmation email",
          operation: "sendTransferRequestConfirmation",
          projectId: projectIdOld,
          error,
        }),
    );
  }

  async sendProjectTransferComplete(
    email: string,
    experimentId: string,
    experimentName: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending project transfer complete email",
          operation: "sendProjectTransferComplete",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: experimentUrl } = new URL(`/platform/experiments/${experimentId}`, baseUrl);

        const { html, text } = await this.renderProjectTransferCompleteEmail({
          host,
          experimentName,
          experimentUrl,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: email,
          subject: `Project Transfer Complete - openJII`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Project transfer complete email sent successfully",
          operation: "sendProjectTransferComplete",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send project transfer complete email",
          operation: "sendProjectTransferComplete",
          experimentId,
          error,
        }),
    );
  }

  async sendJoinRequestSubmittedNotification(
    experimentId: string,
    experimentName: string,
    requesterName: string,
    adminEmail: string,
    message?: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending join request submitted notification",
          operation: "sendJoinRequestSubmittedNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: experimentUrl } = new URL(`/platform/experiments/${experimentId}`, baseUrl);

        const { html, text } = await this.renderJoinRequestSubmittedEmail({
          host,
          experimentName,
          experimentUrl,
          requesterName,
          message,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: adminEmail,
          subject: `New request to join ${experimentName} on openJII`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Join request submitted notification sent",
          operation: "sendJoinRequestSubmittedNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send join request submitted notification",
          operation: "sendJoinRequestSubmittedNotification",
          experimentId,
          error,
        }),
    );
  }

  async sendJoinRequestRejectedNotification(
    experimentId: string,
    experimentName: string,
    requesterEmail: string,
    unsubscribe?: NotificationEmailUnsubscribe,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending join request rejected notification",
          operation: "sendJoinRequestRejectedNotification",
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);

        const { html, text } = await this.renderJoinRequestRejectedEmail({
          host,
          experimentName,
          baseUrl,
          unsubscribe,
        });

        await this.dispatch({
          to: requesterEmail,
          subject: `Update on your request to join ${experimentName}`,
          html,
          text,
          unsubscribe,
        });

        this.logger.log({
          msg: "Join request rejected notification sent",
          operation: "sendJoinRequestRejectedNotification",
          experimentId,
          status: "success",
        });
      },
      (error) =>
        this.sendFailure(error, {
          msg: "Failed to send join request rejected notification",
          operation: "sendJoinRequestRejectedNotification",
          experimentId,
          error,
        }),
    );
  }
}
