import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Newsletter port
 */
export const NEWSLETTER_PORT = Symbol("NEWSLETTER_PORT");

/**
 * Live subscription status of an address in the newsletter provider.
 * `none` means the address is not a member at all.
 */
export type NewsletterStatus = "subscribed" | "pending" | "unsubscribed" | "none";

/**
 * Port interface for newsletter subscription operations. Mailchimp is the
 * source of truth; no subscription state is persisted locally.
 */
export interface NewsletterPort {
  /**
   * Double opt-in path (anonymous footer). Upserts the member as `pending` so
   * the provider sends a confirmation email, and applies the Community group/tag.
   */
  subscribePending(email: string): Promise<Result<void>>;

  /**
   * Direct subscribe (authenticated surfaces, email already verified). Upserts
   * the member as `subscribed`; falls back to `pending` when the provider
   * rejects the direct subscribe due to a compliance state. Returns the
   * resulting status.
   */
  subscribeDirect(email: string): Promise<Result<NewsletterStatus>>;

  /**
   * Sets the member to `unsubscribed` (the member is kept, per the provider's
   * compliance model).
   */
  unsubscribe(email: string): Promise<Result<void>>;

  /**
   * Reads the live subscription status of the given address.
   */
  getStatus(email: string): Promise<Result<NewsletterStatus>>;

  /**
   * Permanently deletes the member (GDPR erasure).
   */
  deleteMember(email: string): Promise<Result<void>>;
}
