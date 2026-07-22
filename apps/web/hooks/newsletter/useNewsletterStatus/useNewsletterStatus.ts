"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Reads the signed-in user's live newsletter membership status from Mailchimp. */
export function useNewsletterStatus() {
  return useQuery(orpc.newsletter.getStatus.queryOptions());
}
