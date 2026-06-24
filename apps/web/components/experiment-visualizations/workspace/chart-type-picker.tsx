"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  ExperimentChartFamily,
  ExperimentChartType,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { getChartTypeDef, listChartTypesByFamily } from "../charts/chart-registry";
import type { ChartTypeDef } from "../charts/types";

const FAMILY_ORDER: ExperimentChartFamily[] = ["basic", "statistical", "scientific", "3d"];

interface ChartTypePickerProps {
  value: ExperimentChartType;
  onChange: (type: ExperimentChartType) => void;
}

export function ChartTypePicker({ value, onChange }: ChartTypePickerProps) {
  const { t } = useTranslation("experimentVisualizations");
  const [open, setOpen] = useState(false);

  const current = getChartTypeDef(value);
  const TriggerIcon = current.icon;
  const pickerLabel = t("workspace.charts.pickerLabel");

  const handlePick = (type: ExperimentChartType) => {
    onChange(type);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2" aria-label={pickerLabel}>
          <TriggerIcon className="size-4" />
          <span className="text-sm font-medium">{t(current.labelKey)}</span>
          <ChevronDown className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[440px] p-0" align="start" sideOffset={8}>
        <ChartTypePickerContent value={value} onPick={handlePick} />
      </PopoverContent>
    </Popover>
  );
}

interface ChartTypePickerContentProps {
  /** Highlighted tile + initial family tab. Pass any ExperimentChartType (e.g. "line") for create flows. */
  value: ExperimentChartType;
  onPick: (type: ExperimentChartType) => void;
}

export function ChartTypePickerContent({ value, onPick }: ChartTypePickerContentProps) {
  const { t } = useTranslation("experimentVisualizations");
  const grouped = useMemo(() => listChartTypesByFamily(), []);
  const current = getChartTypeDef(value);
  const pickerLabel = t("workspace.charts.pickerLabel");

  // Hide families with no registered chart types (e.g. empty "3d" tab).
  const availableFamilies = useMemo(
    () => FAMILY_ORDER.filter((family) => grouped[family].length > 0),
    [grouped],
  );

  // Radix unmounts PopoverContent on close, so the lazy initializer reruns
  // each open. Avoid a useEffect on `value` here: it snaps mid-browse.
  const [activeFamily, setActiveFamily] = useState<ExperimentChartFamily>(() =>
    availableFamilies.includes(current.family) ? current.family : (availableFamilies[0] ?? "basic"),
  );

  const types = grouped[activeFamily];

  return (
    <>
      <div role="tablist" aria-label={pickerLabel} className="flex border-b">
        {availableFamilies.map((family) => (
          <FamilyTab
            key={family}
            family={family}
            label={t(`workspace.families.${family}`)}
            isActive={family === activeFamily}
            onSelect={setActiveFamily}
          />
        ))}
      </div>
      <ScrollArea className="max-h-[420px]">
        <div
          role="tabpanel"
          id={`chart-type-panel-${activeFamily}`}
          aria-labelledby={`chart-type-tab-${activeFamily}`}
          className="p-4"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {types.map((def) => (
              <ChartTypeTile
                key={def.type}
                def={def}
                isActive={def.type === value}
                label={t(def.labelKey)}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

interface FamilyTabProps {
  family: ExperimentChartFamily;
  label: string;
  isActive: boolean;
  onSelect: (family: ExperimentChartFamily) => void;
}

function FamilyTab({ family, label, isActive, onSelect }: FamilyTabProps) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`chart-type-panel-${family}`}
      onClick={() => onSelect(family)}
      className={cn(
        "flex-1 px-3 py-2 text-xs font-medium transition-colors",
        isActive
          ? "border-primary text-foreground -mb-px border-b-2"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

interface ChartTypeTileProps {
  def: ChartTypeDef;
  isActive: boolean;
  label: string;
  onPick: (type: ExperimentChartType) => void;
}

function ChartTypeTile({ def, isActive, label, onPick }: ChartTypeTileProps) {
  const TileIcon = def.icon;
  return (
    <button
      type="button"
      onClick={() => onPick(def.type)}
      aria-pressed={isActive}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors",
        isActive
          ? "border-primary bg-primary/5 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent",
      )}
    >
      <TileIcon className="size-5" />
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
