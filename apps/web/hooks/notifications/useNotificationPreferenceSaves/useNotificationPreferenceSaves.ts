import { useMutationState } from "@tanstack/react-query";

import type {
  NotificationCategory,
  UpdateNotificationPreferenceBody,
} from "@repo/api/domains/notification/notification.schema";
import { useSession } from "@repo/auth/client";

import { notificationPreferenceMutationKey } from "../useUpdateNotificationPreference/useUpdateNotificationPreference";

export interface NotificationPreferenceSaves {
  /** Categories with a request still out, so their switch stays held. */
  savingCategories: Set<NotificationCategory>;
  /** Whether any category's most recent finished save failed. */
  hasFailedSave: boolean;
}

/**
 * Every save this person has made on this page, not just the latest one.
 *
 * A `useMutation` result tracks only its most recent call, so with two flips in
 * flight the first switch would re-enable early and a failure of it would be
 * reported as the second one's. Reading the mutation cache instead keeps each
 * category's own state.
 */
export const useNotificationPreferenceSaves = (): NotificationPreferenceSaves => {
  const { data: session } = useSession();

  const saves = useMutationState({
    filters: { mutationKey: notificationPreferenceMutationKey(session?.user.id) },
    select: (mutation) => ({
      status: mutation.state.status,
      category: (mutation.state.variables as UpdateNotificationPreferenceBody | undefined)
        ?.category,
    }),
  });

  const savingCategories = new Set(
    saves
      .filter((save) => save.status === "pending")
      .map((save) => save.category)
      .filter((category): category is NotificationCategory => category !== undefined),
  );

  // Insertion order is submission order, so a later save of the same category
  // overwrites the verdict of an earlier one: one success clears its own error.
  const settled = new Map<NotificationCategory, string>();
  for (const save of saves) {
    if (save.category === undefined || save.status === "pending" || save.status === "idle") {
      continue;
    }
    settled.set(save.category, save.status);
  }

  return { savingCategories, hasFailedSave: [...settled.values()].includes("error") };
};
