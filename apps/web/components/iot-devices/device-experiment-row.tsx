"use client";

import { useLocale } from "@/hooks/useLocale";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";

export interface DeviceExperimentRowItem {
  id: string;
  name: string;
  status: string;
  /** Already streaming into this experiment; the row locks rather than checks. */
  bound: boolean;
}

interface DeviceExperimentRowProps {
  experiment: DeviceExperimentRowItem;
  selected: boolean;
  onToggle: (experimentId: string, checked: boolean) => void;
  /** Trailing slot, e.g. the bound row's remove menu. */
  trailing?: React.ReactNode;
}

/**
 * One experiment row, two states. The surface previously ran two lists with two
 * different grammars: bound experiments as an icon plus a status badge, and
 * selectable ones as a checkbox and a bare label, so the same entity looked
 * like two kinds of thing depending on which card it landed in.
 *
 * A bound row shows a locked check rather than a ticked checkbox, because it is
 * a fact rather than a choice, and its name links out.
 */
export function DeviceExperimentRow({
  experiment,
  selected,
  onToggle,
  trailing,
}: DeviceExperimentRowProps) {
  const { t: tExperiments } = useTranslation("experiments");
  const locale = useLocale();

  const status = (
    <Badge variant="outline" className="shrink-0">
      {tExperiments(`status.${experiment.status}`)}
    </Badge>
  );

  if (experiment.bound) {
    return (
      <li className="flex items-center gap-3 px-3 py-2.5">
        <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
        <Link
          href={`/${locale}/platform/experiments/${experiment.id}`}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:ring-2"
        >
          {experiment.name}
        </Link>
        {status}
        {trailing}
      </li>
    );
  }

  return (
    <li>
      <Label className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 px-3 py-2.5 font-normal">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => {
            onToggle(experiment.id, checked === true);
          }}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{experiment.name}</span>
        {status}
        {trailing}
      </Label>
    </li>
  );
}
