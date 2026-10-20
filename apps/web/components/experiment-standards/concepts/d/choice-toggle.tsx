"use client";

import { Check, Lock } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { ChoiceAvailability } from "./standard-choice-row";

interface ChoiceToggleProps {
  availability: ChoiceAvailability;
  isFollowing: boolean;
  onToggle: () => void;
}

/** Follow or Following, locked on for the floor, and a plain note where there is no choice. */
export function ChoiceToggle({ availability, isFollowing, onToggle }: ChoiceToggleProps) {
  const { t } = useTranslation("readinessConceptD");

  if (availability === "required") {
    return (
      <Button variant="secondary" size="sm" className="shrink-0" disabled>
        <Lock aria-hidden />
        {t("choose.following")}
      </Button>
    );
  }

  if (availability === "after-publishing") {
    return (
      <span className="text-muted-foreground shrink-0 text-xs">{t("choose.afterPublishing")}</span>
    );
  }

  if (availability === "not-offered") {
    return <span className="text-muted-foreground shrink-0 text-xs">{t("choose.notOffered")}</span>;
  }

  return (
    <Button
      variant={isFollowing ? "secondary" : "outline"}
      size="sm"
      className="shrink-0"
      aria-pressed={isFollowing}
      onClick={onToggle}
    >
      {isFollowing ? <Check aria-hidden /> : null}
      {isFollowing ? t("choose.following") : t("choose.follow")}
    </Button>
  );
}
