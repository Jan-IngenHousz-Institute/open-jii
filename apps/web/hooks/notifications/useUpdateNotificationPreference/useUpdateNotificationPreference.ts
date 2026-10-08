import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { NotificationPreferences } from "@repo/api/domains/notification/notification.schema";
import { useSession } from "@repo/auth/client";

import { notificationPreferencesKey } from "../useNotificationPreferences/useNotificationPreferences";

/**
 * Scoped by principal like the query it writes into. The QueryClient is
 * module-level and `useSignOut` removes queries but not mutations, so an
 * unscoped key would let a failed save by the person who just signed out be
 * read as the next person's — their switches would carry a save error from an
 * account they never used.
 */
export const notificationPreferenceMutationKey = (userId: string | undefined) =>
  withPrincipal(orpc.notifications.updateNotificationPreference.mutationKey(), userId);

/**
 * Identifies a preference row the way the backend's resolve does. Widened to
 * `string` on purpose: `zNotificationChannel` has one member today, so comparing
 * the channels directly is a tautology the linter rejects — and writing the
 * comparison as category-only would silently merge the wrong row the day a second
 * channel is added.
 */
const rowKey = (row: { category: string; channel: string }) => `${row.category}:${row.channel}`;

/**
 * Each response confirms the row it saved and nothing else.
 *
 * The body carries the whole resolved set, but it is a snapshot taken before any
 * save still in flight was written. Two switches flipped in a row produce two such
 * snapshots, and writing a whole one would let the earlier response — if it lands
 * second — put the other category back the way it was. Merging the one saved row
 * makes the order the responses arrive in stop mattering. Still no refetch and no
 * optimistic update.
 */
export const useUpdateNotificationPreference = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    ...orpc.notifications.updateNotificationPreference.mutationOptions({
      onSuccess: (data, variables) => {
        queryClient.setQueryData<NotificationPreferences>(
          notificationPreferencesKey(session?.user.id),
          (cached) => {
            const savedKey = rowKey(variables);
            const saved = data.preferences.find((preference) => rowKey(preference) === savedKey);
            // With nothing cached there is no older set to protect, so the response
            // stands on its own.
            if (!cached || !saved) return data;

            return {
              ...cached,
              preferences: cached.preferences.map((preference) =>
                rowKey(preference) === savedKey ? saved : preference,
              ),
            };
          },
        );
      },
    }),
    mutationKey: notificationPreferenceMutationKey(session?.user.id),
  });
};
