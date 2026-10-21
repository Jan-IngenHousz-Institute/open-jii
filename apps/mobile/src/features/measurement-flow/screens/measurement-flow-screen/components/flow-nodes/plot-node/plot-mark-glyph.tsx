import { Check, MapPin, SkipForward } from "lucide-react-native";
import React from "react";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

/** The glyphs of the shared plot-state legend the phone draws, as the Layout tab draws them. */
export type PlotMark = "measured" | "skipped" | "current";

interface PlotMarkGlyphProps {
  mark: PlotMark;
  size?: number;
}

export function PlotMarkGlyph({ mark, size = 14 }: PlotMarkGlyphProps) {
  const themeColors = useThemeColors();

  switch (mark) {
    case "measured":
      return <Check size={size} color={themeColors.onSurface} strokeWidth={2.5} />;
    case "skipped":
      return <SkipForward size={size} color={themeColors.onSurface} strokeWidth={2.5} />;
    case "current":
      return (
        <MapPin
          size={size}
          color={themeColors.brand}
          fill={`${themeColors.brand}33`}
          strokeWidth={2.5}
        />
      );
  }
}
