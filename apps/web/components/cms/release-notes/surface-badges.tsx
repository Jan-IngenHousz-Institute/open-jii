"use client";

import { Monitor, Smartphone } from "lucide-react";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

type SurfaceKey = "web" | "mobile";

const SURFACE_META: Record<
  SurfaceKey,
  { labelKey: `whatsNew.surface.${SurfaceKey}`; Icon: typeof Monitor }
> = {
  web: { labelKey: "whatsNew.surface.web", Icon: Monitor },
  mobile: { labelKey: "whatsNew.surface.mobile", Icon: Smartphone },
};

/**
 * Resolves the single-select `surfaces` field to the surface badges to show. `both` renders both
 * a Web and a Mobile badge (rather than one "Both" badge); an unset/unknown value renders nothing.
 */
function surfaceKeys(surfaces?: string | null): SurfaceKey[] {
  switch (surfaces) {
    case "web":
      return ["web"];
    case "mobile":
      return ["mobile"];
    case "both":
      return ["web", "mobile"];
    default:
      return [];
  }
}

interface SurfaceBadgesProps {
  /** The release note's `surfaces` value (web / mobile / both). */
  surfaces?: string | null;
  /** Spread onto each badge for Contentful inspector click-to-edit (the `surfaces` field). */
  inspectorProps?: Record<string, unknown> | null;
}

/**
 * Neutral outline badges marking which app(s) a release note targets — shown next to the category
 * badge on the public /releases hero and timeline. Visually distinct from the (colored) category
 * badge so the two read as separate dimensions.
 */
export const SurfaceBadges: React.FC<SurfaceBadgesProps> = ({ surfaces, inspectorProps }) => {
  const { t } = useTranslation("navigation");
  const keys = surfaceKeys(surfaces);

  return (
    <>
      {keys.map((key) => {
        const { labelKey, Icon } = SURFACE_META[key];
        return (
          <Badge
            key={key}
            variant="outline"
            className="border-border text-muted-foreground gap-1 font-normal"
            {...inspectorProps}
          >
            <Icon className="size-3" />
            {t(labelKey)}
          </Badge>
        );
      })}
    </>
  );
};
