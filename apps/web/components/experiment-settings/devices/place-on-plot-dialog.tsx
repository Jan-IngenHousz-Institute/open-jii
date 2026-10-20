"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentDeviceIdentity } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import type { LayoutPlacementCreate } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import {
  AMBYTE_CHANNEL_COUNT,
  zLayoutPlacementCreate,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
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
const CHANNELS = Array.from({ length: AMBYTE_CHANNEL_COUNT }, (_, index) => index + 1);

// The en-CA locale writes a local calendar date as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function PlaceOnPlotDialog({ experimentId, device, onClose }: PlaceOnPlotDialogProps) {
  const { t } = useTranslation("experiments");
  const { t: tIot } = useTranslation("iot");
  const { data: layout } = useExperimentLayout(experimentId);

  const form = useForm<LayoutPlacementCreate>({
    resolver: zodResolver(zLayoutPlacementCreate),
    defaultValues: {
      deviceId: device.id,
      channel: null,
      plotId: "",
      startDate: today(),
      endDate: null,
    },
  });

  const hasChannels = device.deviceType === "ambyte";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onClose)(event);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const renderChannel = (channel: number) => (
    <SelectItem key={channel} value={String(channel)}>
      {t("layout.placement.channelOf", { channel, count: AMBYTE_CHANNEL_COUNT })}
    </SelectItem>
  );

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

            {hasChannels ? (
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.placement.channel")}</FormLabel>
                    <Select
                      value={field.value === null ? WHOLE_DEVICE : String(field.value)}
                      onValueChange={(value) =>
                        field.onChange(value === WHOLE_DEVICE ? null : Number(value))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WHOLE_DEVICE}>{t("layout.placement.wholeDevice")}</SelectItem>
                        {CHANNELS.map(renderChannel)}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("layout.placement.channelHelp")}</FormDescription>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("layout.placement.cancel")}
              </Button>
              <Button type="submit">{t("layout.placement.place")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
