import React from "react";
import { Text, View } from "react-native";
import { ReleaseNoteEntry } from "~/features/release-notes/components/release-note-entry";
import { useTranslation } from "~/shared/i18n";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms/lib/__generated/sdk";

interface MonthGroup {
  key: string;
  label: string;
  entries: ReleaseNoteFields[];
}

function monthLabel(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
  } catch {
    return String(date.getFullYear());
  }
}

/** Groups entries by month, preserving the incoming newest-first order. */
function groupByMonth(entries: ReleaseNoteFields[], locale: string): MonthGroup[] {
  const order: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();

  for (const entry of entries) {
    const date = entry.publishedAt ? new Date(entry.publishedAt as string) : null;
    const valid = date !== null && !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : "undated";

    let group = byKey.get(key);
    if (!group) {
      group = { key, label: valid && date ? monthLabel(date, locale) : "", entries: [] };
      byKey.set(key, group);
      order.push(group);
    }
    group.entries.push(entry);
  }

  return order;
}

export function WhatsNewFeed({
  entries,
  linkBaseHref,
}: {
  entries: ReleaseNoteFields[];
  linkBaseHref?: string;
}) {
  const { i18n } = useTranslation("whatsNew");

  if (entries.length === 0) {
    return null;
  }

  const groups = groupByMonth(entries, i18n.language);

  return (
    <View className="gap-6">
      {groups.map((group) => (
        <View key={group.key} className="gap-4">
          {group.label ? (
            <Text className="text-muted-body text-xs font-semibold uppercase">{group.label}</Text>
          ) : null}
          {group.entries.map((entry) => (
            <ReleaseNoteEntry key={entry.sys.id} entry={entry} linkBaseHref={linkBaseHref} />
          ))}
        </View>
      ))}
    </View>
  );
}
