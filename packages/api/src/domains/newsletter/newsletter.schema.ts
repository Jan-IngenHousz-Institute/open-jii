import { z } from "zod";

export const zNewsletterStatus = z.enum(["subscribed", "pending", "unsubscribed", "none"]);

export type NewsletterStatus = z.infer<typeof zNewsletterStatus>;

export const zNewsletterSubscribeBody = z.object({
  email: z.string().email().describe("Email address to subscribe to the newsletter"),
});

export type NewsletterSubscribeBody = z.infer<typeof zNewsletterSubscribeBody>;

// Deliberately generic: the public endpoint never reveals membership state, so
// the response is the same regardless of whether the address is new or known.
export const zNewsletterSubscribeResponse = z.object({
  success: z.literal(true),
});

export type NewsletterSubscribeResponse = z.infer<typeof zNewsletterSubscribeResponse>;

export const zNewsletterStatusResponse = z.object({
  status: zNewsletterStatus,
});

export type NewsletterStatusResponse = z.infer<typeof zNewsletterStatusResponse>;
