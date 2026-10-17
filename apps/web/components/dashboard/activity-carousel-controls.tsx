"use client";

import { Pause, Play } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface ActivityCarouselControlsProps {
  /** One dot per slide, named for the slide it shows. */
  slides: { key: string; label: string }[];
  selected: number;
  onSelect: (index: number) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
}

/** A dot per slide, and the pause that stops the rotation. */
export function ActivityCarouselControls({
  slides,
  selected,
  onSelect,
  isRunning,
  onToggleRunning,
}: ActivityCarouselControlsProps) {
  const { t } = useTranslation("publicMetrics");

  // The dot is drawn small, but the button around it is a full 24 pixel target.
  const renderDot = (slide: { key: string; label: string }, index: number) => {
    const isSelected = index === selected;
    const showSlide = () => onSelect(index);

    return (
      <button
        key={slide.key}
        type="button"
        onClick={showSlide}
        aria-label={t("dashboard.activity.show", { name: slide.label })}
        aria-current={isSelected}
        className="grid size-6 place-items-center"
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
      <div className="-ml-2 flex items-center">{slides.map(renderDot)}</div>
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
