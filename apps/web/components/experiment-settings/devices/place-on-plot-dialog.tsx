"use client";

import { useExperimentDeviceSensors } from "@/hooks/experiment/useExperimentDeviceSensors/useExperimentDeviceSensors";
import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { useExperimentLayoutPlacements } from "@/hooks/experiment/useExperimentLayoutPlacements/useExperimentLayoutPlacements";
import { formatDate } from "@/util/date";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentDeviceIdentity } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import type {
  DeviceSensor,
  LayoutPlacementCreate,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zLayoutPlacementCreate } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
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
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { PlacementDatePicker } from "./placement-date-picker";
import { PlacementPlotSelect } from "./placement-plot-select";

interface PlaceOnPlotDialogProps {
  experimentId: string;
  device: ExperimentDeviceIdentity;
  onClose: () => void;
}

const WHOLE_DEVICE = "whole";

// The en-CA locale writes a local calendar date as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function PlaceOnPlotDialog({ experimentId, device, onClose }: PlaceOnPlotDialogProps) {
  const { t } = useTranslation("experiments");
  const { t: tIot } = useTranslation("iot");
  const { data: layout } = useExperimentLayout(experimentId);
  const { data: placements = [] } = useExperimentLayoutPlacements(experimentId, {
    deviceId: device.id,
  });
  const { data: sensors = [] } = useExperimentDeviceSensors(experimentId, device.id);

  const form = useForm<LayoutPlacementCreate>({
    resolver: zodResolver(zLayoutPlacementCreate),
    defaultValues: {
      deviceId: device.id,
      sensorId: null,
      plotId: "",
      startDate: today(),
      endDate: null,
    },
  });

  const hasSensors = sensors.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onClose)(event);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const sensorName = (sensor: DeviceSensor) =>
    t("layout.placement.sensorName", { label: sensor.label, id: sensor.sensorId });

  const renderSensor = (sensor: DeviceSensor) => (
    <SelectItem key={sensor.sensorId} value={sensor.sensorId}>
      {sensorName(sensor)}
    </SelectItem>
  );

  const sensorId = form.watch("sensorId");
  const startDate = form.watch("startDate");
  const chosenSensor = sensors.find((sensor) => sensor.sensorId === sensorId);
  const overlapping = placements.find(
    (placement) =>
      placement.sensorId === sensorId &&
      (placement.endDate === null || placement.endDate >= startDate),
  );
  const overlappingPlot = layout?.units.find((unit) => unit.id === overlapping?.plotId)?.identifier;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>{t("layout.placement.title")}</DialogTitle>
          <DialogDescription>{t("layout.placement.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="placement-device">{t("layout.placement.device")}</Label>
              <Input
                id="placement-device"
                value={resolveDeviceLabel(device, tIot)}
                readOnly
                className="bg-muted"
              />
            </div>

            {hasSensors ? (
              <FormField
                control={form.control}
                name="sensorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.placement.sensor")}</FormLabel>
                    <Select
                      value={field.value ?? WHOLE_DEVICE}
                      onValueChange={(value) =>
                        field.onChange(value === WHOLE_DEVICE ? null : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WHOLE_DEVICE}>
                          {t("layout.placement.wholeDevice")}
                        </SelectItem>
                        {sensors.map(renderSensor)}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("layout.placement.sensorHelp")}</FormDescription>
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="plotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.placement.plot")}</FormLabel>
                  <FormControl>
                    <PlacementPlotSelect
                      units={layout?.units ?? []}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.placement.startDate")}</FormLabel>
                  <FormControl>
                    <PlacementDatePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>{t("layout.placement.startDateHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {overlapping === undefined ? null : (
              <p role="alert" className="text-destructive text-sm" data-placement-overlap>
                {t("layout.placement.overlap", {
                  sensor:
                    chosenSensor === undefined
                      ? t("layout.placement.wholeDevice")
                      : sensorName(chosenSensor),
                  plot: overlappingPlot ?? "",
                  date: formatDate(overlapping.startDate),
                })}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("layout.placement.cancel")}
              </Button>
              <Button type="submit" disabled={overlapping !== undefined}>
                {t("layout.placement.place")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
