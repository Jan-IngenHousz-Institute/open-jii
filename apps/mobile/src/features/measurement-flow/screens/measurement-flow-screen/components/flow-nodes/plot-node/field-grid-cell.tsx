import { cva } from "class-variance-authority";
import React from "react";
import { Text, View } from "react-native";

import type { NextPlot, SharePlotState, Treatment } from "./next-plot";

// The web Layout tab's treatment tones (chart-2, chart-4, node-question over white), as fixed values
// because the phone theme has no chart palette.
const TREATMENT_TINTS: Record<Treatment, string> = {
  Control: "bg-[#A8E3BF]",
  Drought: "bg-[#E2D18D]",
  "Severe drought": "bg-[#DBC0CD]",
};

const cell = cva("flex-1 items-center justify-center rounded-md", {
  variants: {
    state: {
      current: "border-jii-darker-green border-[3px]",
      done: "border-success border-2",
      skipped: "border-warning border-2 border-dashed",
      toDo: "",
      otherShare: "opacity-30",
    },
  },
});

interface FieldGridCellProps {
  plot: NextPlot;
  state: SharePlotState;
}

export function FieldGridCell({ plot, state }: FieldGridCellProps) {
  return (
    <View
      accessibilityLabel={plot.identifier}
      className={cell({ state, class: TREATMENT_TINTS[plot.treatment] })}
    >
      <Text className="text-jii-darker-green text-[11px] font-semibold">{plot.identifier}</Text>
    </View>
  );
}
