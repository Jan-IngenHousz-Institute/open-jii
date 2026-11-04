"use client";

import { ownName, personName } from "@/components/people/person-name";
import { UserAvatar } from "@/components/user-avatar";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { overviewTableText } from "./overview-table";

export function ListAuthorCell({ displayName }: { displayName: string | undefined }) {
  const { t } = useTranslation("common");
  const author = { displayName };
  const authorName = personName(author, t);
  return (
    <div className="flex items-center gap-2">
      <UserAvatar name={ownName(author) ?? ""} className="size-6 text-[10px]" />
      <span
        title={authorName}
        className={cn("min-w-0 truncate text-[13px]", overviewTableText.muted)}
      >
        {authorName}
      </span>
    </div>
  );
}
