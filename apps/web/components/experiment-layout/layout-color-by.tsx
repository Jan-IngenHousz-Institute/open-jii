"use client";

import { Palette } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { LayoutColoring } from "./use-layout-coloring";

interface LayoutColorByProps {
  coloring: LayoutColoring;
}

const NONE = "__none__";

export function LayoutColorBy({ coloring }: LayoutColorByProps) {
  const { t } = useTranslation("experiments");

  const handleChange = (value: string) => {
    coloring.setColorBy(value === NONE ? null : value);
  };

  const renderName = (name: string) => (
    <SelectItem key={name} value={name}>
      {name}
    </SelectItem>
  );

  return (
    <div className="flex items-center gap-2" data-color-by>
      <Label
        htmlFor="layout-color-by"
        className="text-muted-foreground flex items-center gap-1.5 text-sm font-normal"
      >
        <Palette className="size-4" aria-hidden />
        {t("layout.colorBy.label")}
      </Label>
      <Select value={coloring.colorBy ?? NONE} onValueChange={handleChange}>
        <SelectTrigger id="layout-color-by" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {coloring.names.map(renderName)}
          <SelectItem value={NONE}>{t("layout.colorBy.none")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
