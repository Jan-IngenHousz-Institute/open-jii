import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";

import { renderAddedUserNotification } from "@repo/transactional/render/added-user-notification";
import { renderProjectTransferComplete } from "@repo/transactional/render/project-transfer-complete";
import { renderTransferRequestConfirmation } from "@repo/transactional/render/transfer-request-confirmation";

import { ErrorCodes } from "../../../../utils/error-codes";
import { apiErrorMapper, tryCatch } from "../../../../utils/fp-utils";
import { EmailConfigService } from "../config/config.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly emailConfigService: EmailConfigService) {}

  protected createMailTransport(serverConfig: string) {
    return createTransport(serverConfig);
  }

  protected renderAddedUserNotificationEmail(
    ...args: Parameters<typeof renderAddedUserNotification>
  ) {
    return renderAddedUserNotification(...args);
  }

  protected renderTransferRequestConfirmationEmail(
    ...args: Parameters<typeof renderTransferRequestConfirmation>
  ) {
    return renderTransferRequestConfirmation(...args);
  }

  protected renderProjectTransferCompleteEmail(
    ...args: Parameters<typeof renderProjectTransferComplete>
  ) {
    return renderProjectTransferComplete(...args);
  }

  async sendAddedUserNotification(
    experimentId: string,
    experimentName: string,
    actor: string,
    role: string,
    email: string,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending added user notification email",
          operation: "sendAddedUserNotification",
          email,
          role,
          experimentId,
          actor,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: experimentUrl } = new URL(`/platform/experiments/${experimentId}`, baseUrl);
        const transport = createTransport(this.emailConfigService.getServer());

        const { html, text } = await this.renderAddedUserNotificationEmail({
          host,
          experimentName,
          experimentUrl,
          actor,
          role,
          baseUrl,
        });

        const result = await transport.sendMail({
          to: email,
          from: {
            name: "openJII",
            address: this.emailConfigService.getFrom(),
          },
          subject: `Added to experiment on the openJII Platform`,
          html,
          text,
        });

        // Handle rejected and pending addresses
        const rejected: (string | Mail.Address)[] = result.rejected;
        const pending: (string | Mail.Address)[] = result.pending;
        const failed: (string | Mail.Address)[] = rejected.concat(pending).filter(Boolean);

        const isAddress = (addr: string | Mail.Address): addr is Mail.Address => {
          return typeof addr === "object" && "address" in addr;
        };

        if (failed.length > 0) {
          const failedAddresses = failed.map((failedAddress) =>
            isAddress(failedAddress) ? failedAddress.address : failedAddress,
          );
          throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
        }

        this.logger.log({
          msg: "Added user notification email sent successfully",
          operation: "sendAddedUserNotification",
          email,
          experimentId,
          status: "success",
        });
      },
      (error) => {
        this.logger.error({
          msg: "Failed to send added user notification email",
          errorCode: ErrorCodes.EMAIL_SEND_FAILED,
          operation: "sendAddedUserNotification",
          email,
          experimentId,
          error,
        });
        return apiErrorMapper(
          `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      },
    );
  }

  async sendTransferRequestConfirmation(
    email: string,
    projectIdOld: string,
    projectUrlOld: string,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending transfer request confirmation email",
          operation: "sendTransferRequestConfirmation",
          email,
          projectId: projectIdOld,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const transport = createTransport(this.emailConfigService.getServer());

        const { html, text } = await this.renderTransferRequestConfirmationEmail({
          host,
          projectIdOld,
          projectUrlOld,
          userEmail: email,
          baseUrl,
        });

        const result = await transport.sendMail({
          to: email,
          from: {
            name: "openJII",
            address: this.emailConfigService.getFrom(),
          },
          subject: `Project Transfer Request Received - openJII`,
          html,
          text,
        });

        // Handle rejected and pending addresses
        const rejected: (string | Mail.Address)[] = result.rejected;
        const pending: (string | Mail.Address)[] = result.pending;
        const failed: (string | Mail.Address)[] = rejected.concat(pending).filter(Boolean);

        const isAddress = (addr: string | Mail.Address): addr is Mail.Address => {
          return typeof addr === "object" && "address" in addr;
        };

        if (failed.length > 0) {
          const failedAddresses = failed.map((failedAddress) =>
            isAddress(failedAddress) ? failedAddress.address : failedAddress,
          );
          throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
        }

        this.logger.log({
          msg: "Transfer request confirmation email sent successfully",
          operation: "sendTransferRequestConfirmation",
          email,
          projectId: projectIdOld,
          status: "success",
        });
      },
      (error) => {
        this.logger.error({
          msg: "Failed to send transfer request confirmation email",
          errorCode: ErrorCodes.EMAIL_SEND_FAILED,
          operation: "sendTransferRequestConfirmation",
          email,
          projectId: projectIdOld,
          error,
        });
        return apiErrorMapper(
          `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      },
    );
  }

  async sendProjectTransferComplete(email: string, experimentId: string, experimentName: string) {
    return await tryCatch(
      async () => {
        this.logger.log({
          msg: "Sending project transfer complete email",
          operation: "sendProjectTransferComplete",
          email,
          experimentId,
        });

        const baseUrl = this.emailConfigService.getBaseUrl();
        const { host } = new URL(baseUrl);
        const { href: experimentUrl } = new URL(`/platform/experiments/${experimentId}`, baseUrl);
        const transport = createTransport(this.emailConfigService.getServer());

        const { html, text } = await this.renderProjectTransferCompleteEmail({
          host,
          experimentName,
          experimentUrl,
          baseUrl,
        });

        const result = await transport.sendMail({
          to: email,
          from: {
            name: "openJII",
            address: this.emailConfigService.getFrom(),
          },
          subject: `Project Transfer Complete - openJII`,
          html,
          text,
        });

        // Handle rejected and pending addresses
        const rejected: (string | Mail.Address)[] = result.rejected;
        const pending: (string | Mail.Address)[] = result.pending;
        const failed: (string | Mail.Address)[] = rejected.concat(pending).filter(Boolean);

        const isAddress = (addr: string | Mail.Address): addr is Mail.Address => {
          return typeof addr === "object" && "address" in addr;
        };

        if (failed.length > 0) {
          const failedAddresses = failed.map((failedAddress) =>
            isAddress(failedAddress) ? failedAddress.address : failedAddress,
          );
          throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
        }

        this.logger.log({
          msg: "Project transfer complete email sent successfully",
          operation: "sendProjectTransferComplete",
          email,
          experimentId,
          status: "success",
        });
      },
      (error) => {
        this.logger.error({
          msg: "Failed to send project transfer complete email",
          errorCode: ErrorCodes.EMAIL_SEND_FAILED,
          operation: "sendProjectTransferComplete",
          email,
          experimentId,
          error,
        });
        return apiErrorMapper(
          `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      },
    );
  }
}
