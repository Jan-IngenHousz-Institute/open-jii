"use client";

import { personDisplayName } from "@/util/person-display-name";
import Image from "next/image";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}`;
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  isGuest?: boolean;
  isFormerGuest?: boolean;
  firstName?: string;
  lastName?: string;
  className?: string;
}

export function UserAvatar({
  avatarUrl,
  firstName,
  lastName,
  className,
  isGuest,
  isFormerGuest,
}: UserAvatarProps) {
  const { t } = useTranslation();
  const displayName = personDisplayName({ firstName, lastName, isGuest, isFormerGuest }, t);
  const [imgError, setImgError] = useState(false);
  const src = avatarUrl ?? null;
  const initials = getInitials(firstName, lastName);

  if (src && !imgError) {
    return (
      <div
        title={displayName}
        className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
      >
        <Image
          src={src}
          alt={initials}
          fill
          unoptimized
          className="object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      title={displayName}
      className={cn(
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
    >
      {initials}
    </div>
  );
}
