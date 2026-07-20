import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { isAxiosError } from "axios";
import { createHash } from "crypto";

import type {
  NewsletterPort,
  NewsletterStatus,
} from "../../../newsletter/core/ports/newsletter.port";
import { getAxiosErrorMessage } from "../../utils/axios-error";
import { ErrorCodes } from "../../utils/error-codes";
import { AppError, apiErrorMapper, failure, Result, success } from "../../utils/fp-utils";
import { MailchimpConfigService } from "./config/config.service";

interface MailchimpMemberResponse {
  status?: string;
}

// Provider states intentionally collapsed to our "unsubscribed" status. Any
// value outside the known set is treated as an error rather than guessed.
const UNSUBSCRIBED_STATES = new Set(["unsubscribed", "cleaned", "transactional", "archived"]);

@Injectable()
export class MailchimpAdapter implements NewsletterPort {
  private readonly logger = new Logger(MailchimpAdapter.name);

  constructor(
    private readonly config: MailchimpConfigService,
    private readonly httpService: HttpService,
  ) {}

  async subscribePending(email: string): Promise<Result<void>> {
    if (!this.config.isConfigured) {
      return this.notConfigured("subscribePending");
    }
    // Branch on current state so the anonymous footer path never regresses an
    // existing member: an already-subscribed address is a no-op (keep them
    // subscribed), while unsubscribed/pending/absent addresses (re)enter the
    // double opt-in confirmation flow.
    const statusResult = await this.getStatus(email);
    if (statusResult.isFailure()) {
      return failure(statusResult.error);
    }
    if (statusResult.value === "subscribed") {
      return success(undefined);
    }

    try {
      await this.upsertMember(email, "pending");
      return success(undefined);
    } catch (error) {
      return this.toFailure(error, ErrorCodes.MAILCHIMP_SUBSCRIBE_FAILED, "subscribePending");
    }
  }

  async subscribeDirect(email: string): Promise<Result<NewsletterStatus>> {
    if (!this.config.isConfigured) {
      return this.notConfigured("subscribeDirect");
    }
    try {
      await this.upsertMember(email, "subscribed");
      return success("subscribed");
    } catch (error) {
      // Mailchimp refuses to directly re-subscribe an address in a compliance
      // state (e.g. a prior unsubscribe); fall back to double opt-in.
      if (this.isComplianceError(error)) {
        this.logger.warn({
          msg: "Direct subscribe rejected by compliance state, falling back to pending",
          operation: "subscribeDirect",
        });
        try {
          await this.upsertMember(email, "pending");
          return success("pending");
        } catch (fallbackError) {
          return this.toFailure(
            fallbackError,
            ErrorCodes.MAILCHIMP_SUBSCRIBE_FAILED,
            "subscribeDirect",
          );
        }
      }
      return this.toFailure(error, ErrorCodes.MAILCHIMP_SUBSCRIBE_FAILED, "subscribeDirect");
    }
  }

  async unsubscribe(email: string): Promise<Result<void>> {
    if (!this.config.isConfigured) {
      return this.notConfigured("unsubscribe");
    }
    try {
      await this.httpService.axiosRef.patch(
        this.memberUrl(email),
        { status: "unsubscribed" },
        this.requestConfig(),
      );
      return success(undefined);
    } catch (error) {
      // Unsubscribing an address that was never a member is a no-op success.
      if (this.isStatus(error, 404)) {
        return success(undefined);
      }
      return this.toFailure(error, ErrorCodes.MAILCHIMP_UNSUBSCRIBE_FAILED, "unsubscribe");
    }
  }

  async getStatus(email: string): Promise<Result<NewsletterStatus>> {
    if (!this.config.isConfigured) {
      return this.notConfigured("getStatus");
    }
    try {
      const response = await this.httpService.axiosRef.get<MailchimpMemberResponse>(
        this.memberUrl(email),
        this.requestConfig(),
      );
      const status = this.mapStatus(response.data.status);
      if (status === null) {
        this.logger.error({
          msg: "Unknown Mailchimp member status",
          errorCode: ErrorCodes.MAILCHIMP_STATUS_FAILED,
          operation: "getStatus",
          providerStatus: response.data.status,
        });
        return failure(
          AppError.internal(
            "Mailchimp returned an unrecognized member status",
            ErrorCodes.MAILCHIMP_STATUS_FAILED,
          ),
        );
      }
      return success(status);
    } catch (error) {
      if (this.isStatus(error, 404)) {
        return success("none");
      }
      return this.toFailure(error, ErrorCodes.MAILCHIMP_STATUS_FAILED, "getStatus");
    }
  }

  async deleteMember(email: string): Promise<Result<void>> {
    if (!this.config.isConfigured) {
      return this.notConfigured("deleteMember");
    }
    try {
      await this.httpService.axiosRef.post(
        `${this.memberUrl(email)}/actions/delete-permanent`,
        undefined,
        this.requestConfig(),
      );
      return success(undefined);
    } catch (error) {
      // Already absent counts as erased.
      if (this.isStatus(error, 404)) {
        return success(undefined);
      }
      return this.toFailure(error, ErrorCodes.MAILCHIMP_DELETE_FAILED, "deleteMember");
    }
  }

  private async upsertMember(email: string, status: "pending" | "subscribed"): Promise<void> {
    const body: Record<string, unknown> = {
      email_address: email,
      status_if_new: status,
      status,
    };

    // A Community interest group is set inline on the member; a Community tag is
    // applied through the dedicated tags endpoint after the upsert.
    if (this.config.communityKind === "group") {
      body.interests = { [this.config.communityId]: true };
    }

    await this.httpService.axiosRef.put(this.memberUrl(email), body, this.requestConfig());

    if (this.config.communityKind === "tag") {
      await this.httpService.axiosRef.post(
        `${this.memberUrl(email)}/tags`,
        { tags: [{ name: this.config.communityName, status: "active" }] },
        this.requestConfig(),
      );
    }
  }

  // Returns null for unknown/malformed statuses so the caller can fail closed
  // instead of guessing a state the settings UI would render as fact.
  private mapStatus(status: string | undefined): NewsletterStatus | null {
    if (status === "subscribed" || status === "pending") {
      return status;
    }
    if (status != null && UNSUBSCRIBED_STATES.has(status)) {
      return "unsubscribed";
    }
    return null;
  }

  private memberUrl(email: string): string {
    return `${this.config.baseUrl}/lists/${this.config.audienceId}/members/${this.subscriberHash(email)}`;
  }

  private subscriberHash(email: string): string {
    return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  }

  private requestConfig() {
    return {
      auth: { username: "anystring", password: this.config.apiKey },
    };
  }

  private isStatus(error: unknown, status: number): boolean {
    return isAxiosError(error) && error.response?.status === status;
  }

  private isComplianceError(error: unknown): boolean {
    if (!isAxiosError(error)) {
      return false;
    }
    const data = error.response?.data as { title?: string; detail?: string } | undefined;
    return /compliance/i.test(`${data?.title ?? ""} ${data?.detail ?? ""}`);
  }

  private notConfigured(operation: string): Result<never> {
    this.logger.warn({
      msg: "Mailchimp is not configured; newsletter operation unavailable",
      errorCode: ErrorCodes.MAILCHIMP_NOT_CONFIGURED,
      operation,
    });
    return failure(
      AppError.internal("Newsletter is not configured", ErrorCodes.MAILCHIMP_NOT_CONFIGURED),
    );
  }

  private toFailure(error: unknown, errorCode: ErrorCodes, operation: string): Result<never> {
    this.logger.error({
      msg: "Mailchimp operation failed",
      errorCode,
      operation,
      error: getAxiosErrorMessage(error),
    });
    return failure(apiErrorMapper(error, "Mailchimp"));
  }
}
