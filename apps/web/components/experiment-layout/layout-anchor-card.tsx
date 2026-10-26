"use client";

import { Map as LocationMap } from "@/components/map";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { FlipVertical2, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  ExperimentLayout,
  LayoutAnchor,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type { ExperimentLocation } from "@repo/api/domains/experiment/locations/experiment-locations.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Label } from "@repo/ui/components/label";
import type { LocationPoint } from "@repo/ui/components/map";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";

import { AnchorGeometry } from "./anchor-geometry";
import { LayoutDecimalInput } from "./layout-decimal-input";
import { LayoutNamingScheme } from "./layout-naming";

interface LayoutAnchorCardProps {
  experimentId: string;
  layout: ExperimentLayout;
  /** Held by the Plots view, so unsaved values survive opening a plot and coming back. */
  form: UseFormReturn<LayoutAnchor>;
  onClose: () => void;
}

type ClickTarget = "corner" | "rowEnd";

const MAP_HEIGHT = "300px";
const FIELD_ZOOM = 18;
const COORDINATE_DIGITS = 6;
const METER_DIGITS = 1;

function formatPoint(point: { latitude: number; longitude: number } | null): string | null {
  return point === null
    ? null
    : `${point.latitude.toFixed(COORDINATE_DIGITS)}, ${point.longitude.toFixed(COORDINATE_DIGITS)}`;
}

export function LayoutAnchorCard({ experimentId, layout, form, onClose }: LayoutAnchorCardProps) {
  const { t } = useTranslation("experiments");
  const { data: locations = [] } = useExperimentLocations(experimentId);
  const [target, setTarget] = useState<ClickTarget>("corner");

  const anchor = form.watch();
  const geometry = new AnchorGeometry(anchor, layout.rows, layout.columns);
  const naming = new LayoutNamingScheme(
    layout.naming ?? "rowLetter",
    layout.columns,
    layout.firstNumber ?? 1,
  );
  const first = naming.identifier(1, 1);
  const rowEnd = naming.identifier(1, layout.columns);
  const location = locations.find((candidate) => candidate.id === anchor.locationId);
  const cornerText = formatPoint(anchor.corner);
  const rowEndText = formatPoint(anchor.rowEnd);
  const hasPlacement = geometry.bearing !== null && geometry.columnSpacing !== null;

  const mapPoints: LocationPoint[] = [
    ...(location === undefined
      ? []
      : [
          {
            id: location.id,
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
          },
        ]),
    ...(anchor.corner === null
      ? []
      : [
          {
            id: "corner",
            name: t("layout.anchor.cornerPin", { identifier: first }),
            ...anchor.corner,
          },
        ]),
    ...(anchor.rowEnd === null
      ? []
      : [
          {
            id: "rowEnd",
            name: t("layout.anchor.cornerPin", { identifier: rowEnd }),
            ...anchor.rowEnd,
          },
        ]),
  ];
  const center: [number, number] | undefined =
    anchor.corner === null
      ? location === undefined
        ? undefined
        : [location.latitude, location.longitude]
      : [anchor.corner.latitude, anchor.corner.longitude];

  const placePoint = (points: LocationPoint[]) => {
    const placed = points.at(-1);
    if (placed === undefined) {
      return;
    }
    const point = { latitude: placed.latitude, longitude: placed.longitude };
    form.setValue(target, point);
    setTarget(target === "corner" ? "rowEnd" : "corner");
  };

  const flip = () => form.setValue("isFlipped", !anchor.isFlipped, { shouldDirty: true });

  const outlineHelp = () => {
    if (!geometry.isComplete) {
      return t("layout.anchor.partialHelp");
    }
    return anchor.isFlipped
      ? t("layout.anchor.outlineHelpLeft")
      : t("layout.anchor.outlineHelpRight");
  };

  const chooseTarget = (value: string) => {
    if (value === "corner" || value === "rowEnd") {
      setTarget(value);
    }
  };

  const renderLocation = (candidate: ExperimentLocation) => (
    <SelectItem key={candidate.id} value={candidate.id}>
      {candidate.country ? `${candidate.name}, ${candidate.country}` : candidate.name}
    </SelectItem>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("layout.anchor.title")}</CardTitle>
        <CardDescription>{t("layout.anchor.description")}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label={t("layout.plot.close")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form className="space-y-5">
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.anchor.location")}</FormLabel>
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("layout.anchor.locationPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map(renderLocation)}
                      <SelectItem value="new">{t("layout.anchor.newLocation")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>{t("layout.anchor.locationHelp")}</FormDescription>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>{t("layout.anchor.corners")}</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={target}
                onValueChange={chooseTarget}
                className="w-full"
              >
                <ToggleGroupItem
                  value="corner"
                  className="h-auto flex-1 flex-col items-start gap-0 px-3 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {t("layout.anchor.cornerLabel", { identifier: first })}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {cornerText ?? t("layout.anchor.clickMap")}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="rowEnd"
                  className="h-auto flex-1 flex-col items-start gap-0 px-3 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {t("layout.anchor.rowEndLabel", { identifier: rowEnd })}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {rowEndText ?? t("layout.anchor.clickMap")}
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
              {hasPlacement ? (
                <p className="text-sm" data-anchor-derived>
                  {t("layout.anchor.derived", {
                    bearing: Math.round(geometry.bearing),
                    spacing: geometry.columnSpacing.toFixed(METER_DIGITS),
                  })}
                </p>
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="rowSpacing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.anchor.rowSpacing")}</FormLabel>
                  <FormControl>
                    <LayoutDecimalInput {...field} fractionDigits={METER_DIGITS} />
                  </FormControl>
                  <FormDescription>{t("layout.anchor.rowSpacingHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1.5">
              <LocationMap
                locations={mapPoints}
                onLocationsChange={placePoint}
                selectionMode
                height={MAP_HEIGHT}
                center={center}
                zoom={FIELD_ZOOM}
                outline={geometry.outline()}
                useClustering={false}
                showScale
                showSidebar={false}
                showLocationSearch={false}
                showDistances={false}
                fitBoundsOnMapLoad={false}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-muted-foreground text-xs">{outlineHelp()}</p>
                {geometry.isComplete ? (
                  <Button type="button" variant="outline" size="sm" onClick={flip}>
                    <FlipVertical2 className="size-4" aria-hidden />
                    {t("layout.anchor.flip")}
                  </Button>
                ) : null}
              </div>
            </div>

            <Button type="submit">{t("layout.anchor.save")}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
