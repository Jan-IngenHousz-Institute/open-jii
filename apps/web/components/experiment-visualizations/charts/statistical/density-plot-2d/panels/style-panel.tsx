"use client";

import { Fragment } from "react";

import { Separator } from "@repo/ui/components/separator";

import type { ChartPanelProps } from "../../../types";
import { densityPlot2DStyleShelves } from "../shelves/style-shelves";

export function DensityPlot2DStylePanel({ form, columns }: ChartPanelProps) {
  return (
    <div className="space-y-6">
      {densityPlot2DStyleShelves
        .filter((shelf) => !shelf.visible || shelf.visible(form))
        .map((shelf, index) => {
          const Comp = shelf.Component;
          return (
            <Fragment key={shelf.key}>
              {index > 0 && <Separator />}
              <Comp form={form} columns={columns} />
            </Fragment>
          );
        })}
    </div>
  );
}
