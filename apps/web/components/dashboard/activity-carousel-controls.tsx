"use client";

import { Pause, Play } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface ActivityCarouselControlsProps {
  /** One per slide, naming it for the dot that shows it. */
  labels: string[];
  selected: number;
  onSelect: (index: number) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
}

/** A dot per slide, and the pause that stops the rotation. */
export function ActivityCarouselControls({
  labels,
  selected,
  onSelect,
  isRunning,
  onToggleRunning,
}: ActivityCarouselControlsProps) {
  const { t } = useTranslation("publicMetrics");

  // The dot is drawn small, but the button around it is a full target.
  const renderDot = (label: string, index: number) => {
    const isSelected = index === selected;
    const showSlide = () => onSelect(index);

    return (
      <button
        key={label}
        type="button"
        onClick={showSlide}
        aria-label={t("dashboard.activity.show", { name: label })}
        aria-current={isSelected}
        className="grid size-5 place-items-center"
      >
        <span
          className={cn(
            "h-1.5 rounded-full transition-all",
            isSelected ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5",
          )}
        />
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between">
      <div className="-ml-1.5 flex items-center">{labels.map(renderDot)}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onToggleRunning}
        aria-label={isRunning ? t("dashboard.activity.pause") : t("dashboard.activity.resume")}
        className="text-muted-foreground"
      >
        {isRunning ? <Pause /> : <Play />}
      </Button>
    </div>
  );
}
