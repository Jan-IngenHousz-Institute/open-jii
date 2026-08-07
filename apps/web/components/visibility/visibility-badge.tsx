"use client";

import { Globe, Lock } from "lucide-react";

import type { Visibility } from "@repo/api/domains/visibility/visibility.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface VisibilityBadgeProps {
  visibility: Visibility;
  /** Render only when private — for lists where "public" is the unremarkable default. */
  privateOnly?: boolean;
  className?: string;
}

/** Private / Public resource indicator. */
export function VisibilityBadge({
  visibility,
  privateOnly = false,
  className,
}: VisibilityBadgeProps) {
  const { t } = useTranslation();

  if (privateOnly && visibility === "public") return null;

  const isPrivate = visibility === "private";

  return (
    <Badge variant="outline" className={`gap-1 font-normal ${className ?? ""}`}>
      {isPrivate ? (
        <Lock className="h-3 w-3" aria-hidden />
      ) : (
        <Globe className="h-3 w-3" aria-hidden />
      )}
      {isPrivate ? t("resourceVisibility.privateStatus") : t("resourceVisibility.publicStatus")}
    </Badge>
  );
}
