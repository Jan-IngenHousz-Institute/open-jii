import { cva } from "class-variance-authority";
import React from "react";
import { Pressable, Text, View } from "react-native";

import type { PlotState } from "./next-plot";
import { PlotHatch } from "./plot-hatch";
import { PlotMarkGlyph } from "./plot-mark-glyph";
import type { PlotMark } from "./plot-mark-glyph";

export const PLOT_CELL_SIZE = 48;

// Neutral fill unless the experiment shows treatment to measurers; a glyph carries the state.
const cell = cva("items-center justify-center overflow-hidden rounded-md bg-muted/50", {
  variants: {
    isSelected: {
      true: "border-foreground border-[3px]",
      false: "border-foreground/15 border",
    },
  },
});

function markOf(isCurrent: boolean, state: PlotState): PlotMark | undefined {
  if (isCurrent) {
    return "current";
  }
  if (state === "measured" || state === "skipped") {
    return state;
  }
  return undefined;
}

interface PlotStateCellProps {
  identifier: string;
  state: PlotState;
  isCurrent: boolean;
  isOtherShare?: boolean;
  isSelected?: boolean;
  onPress?: (identifier: string) => void;
}

/** One plot drawn by the shared plot-state legend, with a hatch over a plot in another share. */
export function PlotStateCell({
  identifier,
  state,
  isCurrent,
  isOtherShare = false,
  isSelected = false,
  onPress,
}: PlotStateCellProps) {
  const mark = markOf(isCurrent, state);
  const className = cell({ isSelected });
  const style = { width: PLOT_CELL_SIZE, height: PLOT_CELL_SIZE };

  const handlePress = () => onPress?.(identifier);

  const content = (
    <>
      {isOtherShare ? <PlotHatch /> : null}
      <Text className="text-foreground text-sm font-semibold">{identifier}</Text>
      {mark ? (
        <View style={{ position: "absolute", top: 3, right: 3 }}>
          <PlotMarkGlyph mark={mark} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={identifier} className={className} style={style}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={identifier}
      accessibilityState={{ selected: isSelected }}
      onPress={handlePress}
      className={className}
      style={style}
    >
      {content}
    </Pressable>
  );
}
