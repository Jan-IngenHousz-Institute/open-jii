"use client";

import { useTranslation } from "@repo/i18n";

/** Joins words the way a sentence lists them: "a, b and c". */
export function useListJoin(): (items: readonly string[]) => string {
  const { t } = useTranslation("readinessConceptC");

  return (items) => {
    const head = items.slice(0, -1);
    const last = items.slice(-1).join("");

    if (head.length === 0) {
      return last;
    }

    return t("list.pair", { head: head.join(t("list.separator")), last });
  };
}
