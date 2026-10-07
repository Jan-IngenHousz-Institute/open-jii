"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useNotificationPreferences } from "@/hooks/notifications/useNotificationPreferences/useNotificationPreferences";
import { useUpdateNotificationPreference } from "@/hooks/notifications/useUpdateNotificationPreference/useUpdateNotificationPreference";
import { orpc } from "@/lib/orpc";
import { useMutationState } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";

import type {
  NotificationCategory,
  NotificationPreference,
  UpdateNotificationPreferenceBody,
} from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";

export function NotificationPreferencesCard() {
  const { t } = useTranslation("notifications");
  const preferencesQuery = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  /**
   * Every save, not just the latest. A `useMutation` result tracks only its most
   * recent call, so with two flips in flight the first switch would re-enable
   * early and a failure of it would be reported as the second one's.
   */
  const saves = useMutationState({
    filters: { mutationKey: orpc.notifications.updateNotificationPreference.mutationKey() },
    select: (mutation) => ({
      status: mutation.state.status,
      category: (mutation.state.variables as UpdateNotificationPreferenceBody | undefined)
        ?.category,
    }),
  });

  const savingCategories = new Set(
    saves.filter((save) => save.status === "pending").map((save) => save.category),
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
  const hasFailedSave = [...settled.values()].includes("error");

  const retry = () => void preferencesQuery.refetch();

  const renderPreference = ({
    category,
    channel,
    enabled,
    locked,
    available,
  }: NotificationPreference) => {
    const label = t(`categories.${category}.label`);
    // Only the category being written waits for its own round trip; flipping a
    // second switch while the first saves must stay possible.
    const isSaving = savingCategories.has(category);
    // Locked wins: account security has no email of its own yet either, but it is
    // on for everyone and says so, rather than reading as not built.
    const unavailable = !locked && !available;
    const toggle = (checked: boolean) => update.mutate({ category, channel, enabled: checked });

    return (
      <li key={`${category}:${channel}`} className="flex items-start justify-between gap-4 py-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">{label}</div>
          <p className="text-muted-foreground text-sm">{t(`categories.${category}.description`)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSaving && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
          )}
          {locked && (
            <span className="text-muted-foreground text-xs">{t("preferences.locked")}</span>
          )}
          {unavailable && (
            <span className="text-muted-foreground text-xs">{t("preferences.unavailable")}</span>
          )}
          <Switch
            // A category with no email behind it yet shows off rather than its
            // stored choice: the saved value would promise an effect it has not got.
            checked={unavailable ? false : enabled}
            onCheckedChange={toggle}
            disabled={locked || unavailable || isSaving}
            aria-label={t("preferences.emailLabel", { category: label })}
          />
        </div>
      </li>
    );
  };

  const renderContent = () => {
    if (preferencesQuery.isPending) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("preferences.loading")}
        </div>
      );
    }

    if (preferencesQuery.isError) {
      return (
        <div className="border-destructive/30 bg-destructive/5 rounded-md border p-4">
          <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("preferences.error")}</span>
          </div>
          <Button
            className="mt-3"
            type="button"
            variant="outline"
            size="sm"
            disabled={preferencesQuery.isFetching}
            onClick={retry}
          >
            {t("retry")}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ul className="divide-y">{preferencesQuery.data.preferences.map(renderPreference)}</ul>
        {hasFailedSave && (
          <p className="text-destructive text-sm" role="alert">
            {t("preferences.updateError")}
          </p>
        )}
        <div className="text-muted-foreground space-y-1 border-t pt-4 text-sm">
          <p>{t("preferences.essentialNote")}</p>
          <p>{t("preferences.newsletterNote")}</p>
        </div>
      </div>
    );
  };

  return (
    <SettingsCard title={t("preferences.title")} description={t("preferences.description")}>
      {renderContent()}
    </SettingsCard>
  );
}
