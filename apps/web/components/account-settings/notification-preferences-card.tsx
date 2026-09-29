"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useNotificationPreferences } from "@/hooks/notifications/useNotificationPreferences/useNotificationPreferences";
import { useUpdateNotificationPreference } from "@/hooks/notifications/useUpdateNotificationPreference/useUpdateNotificationPreference";
import { AlertCircle, BellRing, Loader2 } from "lucide-react";

import type { NotificationPreference } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";

export function NotificationPreferencesCard() {
  const { t } = useTranslation("notifications");
  const preferencesQuery = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  const retry = () => void preferencesQuery.refetch();

  const renderPreference = ({ category, channel, enabled, locked }: NotificationPreference) => {
    const label = t(`categories.${category}.label`);
    const isSaving = update.isPending && update.variables.category === category;
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
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={locked || update.isPending}
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
        {update.isError && (
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
    <SettingsCard
      icon={BellRing}
      title={t("preferences.title")}
      description={t("preferences.description")}
    >
      {renderContent()}
    </SettingsCard>
  );
}
