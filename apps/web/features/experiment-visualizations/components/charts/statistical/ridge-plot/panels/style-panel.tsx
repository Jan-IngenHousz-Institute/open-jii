"use client";

import { Fragment } from "react";

import { Separator } from "@repo/ui/components/separator";

import type { ChartPanelProps } from "../../../types";
import { ridgePlotStyleShelves } from "../shelves/style-shelves";

export function RidgePlotStylePanel({ form, columns }: ChartPanelProps) {
  return (
    <div className="space-y-6">
      {ridgePlotStyleShelves
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
