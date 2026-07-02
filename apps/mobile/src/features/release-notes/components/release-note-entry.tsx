import type { Document } from "@contentful/rich-text-types";
import { ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { getCategoryMeta } from "~/features/release-notes/category";
import { useTranslation } from "~/shared/i18n";
import { Tag } from "~/shared/ui/Tag";
import { CtfRichText } from "~/shared/ui/ctf-rich-text";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { resolveExternalUrl } from "~/shared/utils/resolve-external-url";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms/lib/__generated/sdk";

interface ReleaseNoteEntryProps {
  entry: ReleaseNoteFields;
  /** Base URL for the public release detail page; entries link to `${linkBaseHref}/${slug}`. */
  linkBaseHref?: string;
}

/** Relative-time label ("3 days ago"); falls back to a plain date if Intl is unavailable. */
function formatRelativeTime(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  try {
    const diffSec = Math.round((ms - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (abs < 60) return rtf.format(diffSec, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
    if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
    return rtf.format(Math.round(diffSec / 31536000), "year");
  } catch {
    return new Date(ms).toDateString();
  }
}

export function ReleaseNoteEntry({ entry, linkBaseHref }: ReleaseNoteEntryProps) {
  const { t, i18n } = useTranslation("whatsNew");
  const themeColors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const category = getCategoryMeta(entry.category);
  const media = entry.media;
  // RN renders image/gif heroes directly; video heroes need expo-av, so they're skipped on mobile.
  const showImage = !!media?.url && !media.contentType?.startsWith("video/");
  const relativeTime = entry.publishedAt
    ? formatRelativeTime(entry.publishedAt as string, i18n.language)
    : null;
  const ctaLabel = entry.cta?.label;
  const ctaHref = entry.cta?.url ? resolveExternalUrl(entry.cta.url, linkBaseHref) : undefined;
  const releaseHref = linkBaseHref && entry.slug ? `${linkBaseHref}/${entry.slug}` : undefined;

  return (
    <View className="border-border bg-card shadow-xs overflow-hidden rounded-xl border shadow-black/10">
      {showImage && media?.url && (
        <Image
          source={{ uri: `${media.url}?w=960&fm=webp&fit=fill` }}
          className="aspect-video w-full"
          resizeMode="cover"
        />
      )}

      <View className="gap-3 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Tag variant={category.tagVariant} size="sm">
            {t(category.labelKey)}
          </Tag>
          {relativeTime ? (
            <Text className="text-muted-body shrink text-right text-xs">{relativeTime}</Text>
          ) : null}
        </View>

        <Text
          className="text-on-surface"
          style={{ fontFamily: "Poppins-SemiBold", fontSize: 17, lineHeight: 23 }}
        >
          {entry.title}
        </Text>

        {entry.summary ? (
          <Text className="text-muted-body text-sm leading-5">{entry.summary}</Text>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-2 pt-1">
          {releaseHref ? (
            <Pressable
              onPress={() => void Linking.openURL(releaseHref)}
              hitSlop={6}
              className="bg-primary flex-row items-center gap-1 rounded-lg px-3 py-1.5"
            >
              <Text className="text-primary-foreground text-sm font-semibold">{t("showMore")}</Text>
              <ChevronRight size={14} color={themeColors.onPrimary} />
            </Pressable>
          ) : entry.body?.json ? (
            <Pressable
              onPress={() => setExpanded((prev) => !prev)}
              hitSlop={6}
              className="bg-primary/10 flex-row items-center gap-1 rounded-lg px-3 py-1.5"
            >
              <Text className="text-primary text-sm font-semibold">
                {expanded ? t("showLess") : t("showMore")}
              </Text>
              <ChevronRight size={14} color={themeColors.brand} />
            </Pressable>
          ) : null}

          {ctaHref && ctaLabel ? (
            <Pressable
              onPress={() => void Linking.openURL(ctaHref)}
              hitSlop={6}
              className="border-border bg-surface flex-row items-center gap-1 rounded-lg border px-3 py-1.5"
            >
              <Text className="text-on-surface text-sm font-semibold">{ctaLabel}</Text>
              <ChevronRight size={14} color={themeColors.onSurface} />
            </Pressable>
          ) : null}
        </View>

        {expanded && entry.body?.json ? (
          <View className="border-border border-t pt-3">
            <CtfRichText json={entry.body.json as Document} textClass="text-on-surface" />
          </View>
        ) : null}
      </View>
    </View>
  );
}
