"use client";

import { useTranslation } from "@repo/i18n";

import { personName } from "./person-name";

/** "by {name}" under an item; nothing when its creator has no name to show. */
export function PersonByline({ displayName }: { displayName?: string | null }) {
  const { t } = useTranslation();
  const name = personName({ displayName }, t, { placement: "byline" });
  if (name === null) return null;

  return <p className="text-muted-foreground truncate text-xs">{t("common.byPerson", { name })}</p>;
}
