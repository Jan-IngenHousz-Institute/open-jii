import { cva } from "class-variance-authority";
import { CloudAlert, CloudCheck, UploadCloud } from "lucide-react-native";
import React from "react";
import type { MeasurementStatus } from "~/features/recent-measurements/hooks/use-all-measurements";

interface SemanticColors {
  success: string;
  info: string;
  error: string;
}

// Shared by the single-measurement row and the collapsed workbook-run row: a
// run header must stay visually identical to the rows it collapses.
export const STATUS_ICON: Record<
  MeasurementStatus,
  (c: { semantic: SemanticColors }) => React.ReactNode
> = {
  successful: (c) => <CloudCheck size={16} color={c.semantic.success} />,
  pending: (c) => <UploadCloud size={16} color={c.semantic.info} />,
  failed: (c) => <CloudAlert size={16} color={c.semantic.error} />,
};

export const answersTextStyle = cva("mb-1.5 text-base", {
  variants: {
    state: {
      true: "font-medium",
      false: "font-normal italic",
    },
  },
});
