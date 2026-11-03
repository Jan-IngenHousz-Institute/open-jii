import { overviewTableText } from "@/components/overview-table/overview-table";
import { ownName, personName } from "@/components/people/person-name";
import { UserAvatar } from "@/components/user-avatar";

import { cn } from "@repo/ui/lib/utils";

interface ListAuthorCellProps {
  displayName: string | undefined;
  /** Resolves the `common` fallback for an account without a name. */
  tCommon: (key: string) => string;
}

/** The avatar and name of whoever created a dashboard or chart. */
export function ListAuthorCell({ displayName, tCommon }: ListAuthorCellProps) {
  const author = { displayName };
  const authorName = personName(author, tCommon);
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
