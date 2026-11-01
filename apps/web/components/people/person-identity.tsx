"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { UserAvatar } from "@/components/user-avatar";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import type { PersonLike } from "./person-name";
import { ownName, personName } from "./person-name";

interface PersonIdentityProps {
  person: PersonLike;
  /** Replaces the email line, and wraps where an email truncates; `null` drops the line. */
  identityLine?: string | null;
  /** Off only where the whole surface is about the viewer. */
  showYou?: boolean;
  size?: "sm" | "md";
  /** Sit on the name line, right after the name. */
  badges?: ReactNode;
  /** Further lines under the identity line, such as badges or a reason. */
  children?: ReactNode;
}

export function PersonIdentity({
  person,
  identityLine,
  showYou = true,
  size = "md",
  badges,
  children,
}: PersonIdentityProps) {
  const { t } = useTranslation();
  const { userId } = usePrincipal();
  const name = personName(person, t);
  const own = ownName(person);
  const isViewer = showYou && userId !== undefined && person.id === userId;

  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <UserAvatar
        avatarUrl={person.avatarUrl}
        name={own ?? ""}
        className={size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9"}
      />
      {/* At least the avatar's height, so a lone name line sits level with its middle. */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center",
          size === "sm" ? "min-h-8" : "min-h-9",
        )}
      >
        <NameLine badges={badges}>
          <span className="truncate text-sm font-medium" title={name}>
            {name}
          </span>
          {isViewer && (
            <span className="text-muted-foreground shrink-0 text-xs">{t("sharing.you")}</span>
          )}
        </NameLine>
        {identityLine === undefined ? (
          // Without a name of their own, the name line already shows the email.
          own &&
          person.email && (
            <div className="text-muted-foreground truncate text-xs" title={person.email}>
              {person.email}
            </div>
          )
        ) : identityLine === null ? null : (
          <div className="text-muted-foreground text-xs">{identityLine}</div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * A name with its badges right after it. The name truncates first, to about 12
 * characters; only then do the badges wrap, as one group, under it.
 */
export function NameLine({ badges, children }: { badges?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <div className="flex min-w-0 max-w-max grow basis-20 items-baseline gap-1.5">{children}</div>
      {badges && (
        <div className="flex max-w-full shrink-0 flex-wrap gap-1 empty:hidden">{badges}</div>
      )}
    </div>
  );
}
