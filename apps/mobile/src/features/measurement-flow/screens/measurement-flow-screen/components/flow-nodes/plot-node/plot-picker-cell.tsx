import { cva } from "class-variance-authority";
import { MapPin } from "lucide-react-native";
import React from "react";
import { Pressable, Text } from "react-native";
import { colors } from "~/shared/constants/colors";

import type { NextPlot } from "./next-plot";

type CellTone = "pressed" | "named" | "plain";

const cell = cva("flex-1 items-center justify-center rounded-md border", {
  variants: {
    tone: {
      pressed: "bg-primary border-primary",
      named: "bg-primary/10 border-primary border-2",
      plain: "bg-primary/5 border-primary/20",
    },
    isMeasured: {
      true: "opacity-40",
      false: "",
    },
  },
});

const cellText = cva("text-[11px] font-semibold", {
  variants: {
    tone: {
      pressed: "text-primary-foreground",
      named: "text-primary",
      plain: "text-foreground",
    },
  },
});

function toneOf(isPressed: boolean, isNamed: boolean): CellTone {
  if (isPressed) {
    return "pressed";
  }
  return isNamed ? "named" : "plain";
}

interface PlotPickerCellProps {
  plot: NextPlot;
  isNamed: boolean;
  isMeasured: boolean;
  isPressed: boolean;
  onPressIn: (identifier: string) => void;
  onPressOut: () => void;
  onPick: (plot: NextPlot) => void;
}

export function PlotPickerCell({
  plot,
  isNamed,
  isMeasured,
  isPressed,
  onPressIn,
  onPressOut,
  onPick,
}: PlotPickerCellProps) {
  const tone = toneOf(isPressed, isNamed);

  const handlePressIn = () => onPressIn(plot.identifier);
  const handlePress = () => onPick(plot);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={plot.identifier}
      onPressIn={handlePressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      className={cell({ tone, isMeasured })}
    >
      {isNamed ? (
        <MapPin
          size={9}
          color={colors.jii.darkGreen}
          style={{ position: "absolute", top: 2, right: 2 }}
        />
      ) : null}
      <Text className={cellText({ tone })}>{plot.identifier}</Text>
    </Pressable>
  );
}
