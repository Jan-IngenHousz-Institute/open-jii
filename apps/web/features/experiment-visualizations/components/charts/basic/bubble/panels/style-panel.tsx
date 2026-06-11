"use client";

import { Fragment } from "react";
import { useWatch } from "react-hook-form";

import { Separator } from "@repo/ui/components/separator";

import type { ChartPanelProps } from "../../../types";
import { bubbleStyleShelves } from "../shelves/style-shelves";

export function BubbleStylePanel({ form, columns }: ChartPanelProps) {
  // Broad subscription so `visible(form)` predicates re-evaluate when the
  // user toggles trace types. Each predicate reads with `form.getValues()`
  // inside.
  useWatch({ control: form.control, name: "dataConfig.dataSources" });

  const visibleShelves = bubbleStyleShelves.filter(
    (shelf) => !shelf.visible || shelf.visible(form),
  );

  return (
    <div className="space-y-6">
      {visibleShelves.map((shelf, index) => {
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
