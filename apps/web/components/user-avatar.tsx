"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@repo/ui/lib/utils";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = words.at(0)?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  /** The person's own name (`ownName`), which the initials are taken from. */
  name: string;
  className?: string;
}

export function UserAvatar({ avatarUrl, name, className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const src = avatarUrl ?? null;
  const initials = getInitials(name);

  if (src && !imgError) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden rounded-full", className)}>
        <Image
          src={src}
          alt={initials}
          fill
          unoptimized
          className="object-cover"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  // Spans, so a face can sit inside a paragraph without breaking hydration.
  return (
    <span
      className={cn(
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
    >
      {initials}
    </span>
  );
}
