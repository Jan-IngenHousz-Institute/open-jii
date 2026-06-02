"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@repo/ui/lib/utils";

function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}`;
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  className?: string;
}

export function UserAvatar({ avatarUrl, firstName, lastName, className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const src = avatarUrl ?? null;
  const initials = getInitials(firstName, lastName);

  if (src && !imgError) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
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
      className={cn(
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
    >
      {initials}
    </div>
  );
}
