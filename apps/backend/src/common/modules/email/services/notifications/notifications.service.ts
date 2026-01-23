import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";

import { renderAddedUserNotification } from "@repo/transactional/render/added-user-notification";
import { renderTransferRequestConfirmation } from "@repo/transactional/render/transfer-request-confirmation";

import { ErrorCodes } from "../../../../utils/error-codes";
import { apiErrorMapper, tryCatch } from "../../../../utils/fp-utils";
import { EmailConfigService } from "../config/config.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly emailConfigService: EmailConfigService) {}

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

        const { host } = new URL(this.emailConfigService.getBaseUrl());
        const { href: experimentUrl } = new URL(
          `/platform/experiments/${experimentId}`,
          this.emailConfigService.getBaseUrl(),
        );
        const transport = createTransport(this.emailConfigService.getServer());

        const { html, text } = await renderAddedUserNotification({
          host,
          experimentName,
          experimentUrl,
          actor,
          role,
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

        const { host } = new URL(this.emailConfigService.getBaseUrl());
        const transport = createTransport(this.emailConfigService.getServer());

        const { html, text } = await renderTransferRequestConfirmation({
          host,
          projectIdOld,
          projectUrlOld,
          userEmail: email,
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
}
