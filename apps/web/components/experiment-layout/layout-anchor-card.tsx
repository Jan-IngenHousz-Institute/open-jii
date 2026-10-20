"use client";

import { Map as LocationMap } from "@/components/map";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { ExperimentLayout } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zLayoutAnchor } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
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
import { Input } from "@repo/ui/components/input";
import type { LocationPoint } from "@repo/ui/components/map";

import { LayoutDecimalInput } from "./layout-decimal-input";
import { rowLetter } from "./row-letter";

interface LayoutAnchorCardProps {
  layout: ExperimentLayout;
  onClose: () => void;
}

const MAP_HEIGHT = "280px";

// Matches the map's own popup, so a corner reads the same in the field and on the map.
const COORDINATE_DIGITS = 6;
const METER_DIGITS = 2;

type AnchorForm = z.infer<typeof zLayoutAnchor>;

function numberOrNull(event: ChangeEvent<HTMLInputElement>): number | null {
  return event.target.value === "" ? null : event.target.valueAsNumber;
}

export function LayoutAnchorCard({ layout, onClose }: LayoutAnchorCardProps) {
  const { t } = useTranslation("experiments");
  const form = useForm<AnchorForm>({
    resolver: zodResolver(zLayoutAnchor),
    defaultValues: {
      latitude: null,
      longitude: null,
      bearing: null,
      plotWidth: null,
      plotLength: null,
      ...layout.anchor,
    },
  });

  const firstIdentifier = `${rowLetter(1)}1`;
  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");
  const hasCorner = latitude !== null && longitude !== null;

  const cornerLocations: LocationPoint[] = hasCorner
    ? [
        {
          id: "anchor",
          name: t("layout.anchor.corner", { identifier: firstIdentifier }),
          latitude,
          longitude,
        },
      ]
    : [];

  const placeCorner = (locations: LocationPoint[]) => {
    const placed = locations.at(-1);
    if (placed !== undefined) {
      form.setValue("latitude", placed.latitude);
      form.setValue("longitude", placed.longitude);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("layout.anchor.title")}</CardTitle>
        <CardDescription>
          {t("layout.anchor.description", {
            level: layout.levelName.toLowerCase(),
            identifier: firstIdentifier,
          })}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label={t("layout.plot.close")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.anchor.latitude")}</FormLabel>
                    <FormControl>
                      <LayoutDecimalInput {...field} fractionDigits={COORDINATE_DIGITS} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.anchor.longitude")}</FormLabel>
                    <FormControl>
                      <LayoutDecimalInput {...field} fractionDigits={COORDINATE_DIGITS} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bearing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.anchor.bearing")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={359}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(numberOrNull(event))}
                    />
                  </FormControl>
                  <FormDescription>{t("layout.anchor.bearingHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="plotWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("layout.anchor.plotWidth")}</FormLabel>
                      <FormControl>
                        <LayoutDecimalInput {...field} fractionDigits={METER_DIGITS} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plotLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("layout.anchor.plotLength")}</FormLabel>
                      <FormControl>
                        <LayoutDecimalInput {...field} fractionDigits={METER_DIGITS} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-muted-foreground text-sm">{t("layout.anchor.plotSizeHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <LocationMap
                locations={cornerLocations}
                onLocationsChange={placeCorner}
                selectionMode
                height={MAP_HEIGHT}
                center={hasCorner ? [latitude, longitude] : undefined}
                useClustering={false}
                showScale={false}
                showSidebar={false}
                showLocationSearch={false}
                showDistances={false}
              />
              <p className="text-muted-foreground text-xs">{t("layout.anchor.mapHelp")}</p>
            </div>

            <Button type="submit">{t("layout.anchor.save")}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
