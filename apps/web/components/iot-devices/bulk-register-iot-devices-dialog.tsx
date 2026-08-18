"use client";

import { useBulkRegisterIotDevices } from "@/hooks/iot/useBulkRegisterIotDevices/useBulkRegisterIotDevices";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { BulkRegisterIotDevicesResult } from "@repo/api/domains/iot/iot.schema";
import { zRegisterableDeviceType } from "@repo/api/domains/iot/iot.schema";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

import { parseBulkBatch } from "./bulk-register-parse";
import { BulkRegisterPreview } from "./bulk-register-preview";
import { BulkRegisterResults } from "./bulk-register-results";

const MAX_BATCH = 100;

const bulkRegisterFormSchema = z
  .object({
    deviceType: zRegisterableDeviceType,
    serials: z.string(),
    groupMode: z.enum(["none", "existing", "new"]),
    groupId: z.string().optional(),
    groupName: z.string().max(255).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.groupMode === "existing" && !values.groupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupId"],
        message: "Pick a group",
      });
    }
    if (values.groupMode === "new" && !values.groupName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupName"],
        message: "Name the new group",
      });
    }
  });

type BulkRegisterFormValues = z.infer<typeof bulkRegisterFormSchema>;

interface BulkRegisterIotDevicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Paste or import a manufacturer list, watch every line classify itself
 * against the batch and the registry, then register only what is actually
 * registrable. The pre-flight is the point: nothing is sent while a surprise
 * is still visible.
 */
export function BulkRegisterIotDevicesDialog({
  open,
  onOpenChange,
}: BulkRegisterIotDevicesDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const { data: groups } = useIotDeviceGroups();
  const { data: devices } = useIotDevices();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<BulkRegisterIotDevicesResult | null>(null);

  const form = useForm<BulkRegisterFormValues>({
    resolver: zodResolver(bulkRegisterFormSchema),
    defaultValues: {
      deviceType: undefined,
      serials: "",
      groupMode: "none",
      groupId: undefined,
      groupName: "",
    },
  });
  const groupMode = form.watch("groupMode");
  const serialsText = form.watch("serials");

  const registeredSerials = useMemo(
    () => new Set((devices ?? []).map((device) => device.serialNumber)),
    [devices],
  );
  const batch = useMemo(
    () => parseBulkBatch(serialsText, registeredSerials),
    [serialsText, registeredSerials],
  );
  const overCap = batch.counts.ready > MAX_BATCH;
  const canSubmit = batch.counts.ready > 0 && !overCap;

  const bulkRegister = useBulkRegisterIotDevices({
    onSuccess: (outcome) => {
      const failures = outcome.devices.filter((row) => row.error !== null);
      setResult(outcome);
      if (failures.length === 0 && outcome.groupError === null) {
        toast({
          title: t("iot.devices.bulkDialog.successToast", { count: outcome.devices.length }),
        });
      }
    },
  });

  function closeAndReset() {
    form.reset();
    setResult(null);
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closeAndReset();
      return;
    }
    onOpenChange(nextOpen);
  }

  function appendFileContents(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const current = form.getValues("serials");
      form.setValue("serials", current === "" ? reader.result : `${current}\n${reader.result}`, {
        shouldDirty: true,
      });
    };
    reader.readAsText(file);
  }

  function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) appendFileContents(file);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    appendFileContents(event.dataTransfer.files[0]);
  }

  function onSubmit(values: BulkRegisterFormValues) {
    const group =
      values.groupMode === "existing" && values.groupId
        ? { groupId: values.groupId }
        : values.groupMode === "new" && values.groupName
          ? { name: values.groupName.trim() }
          : undefined;

    bulkRegister.mutate(
      { devices: batch.ready, deviceType: values.deviceType, ...(group ? { group } : {}) },
      {
        onError: () => {
          toast({ title: t("iot.devices.dialog.createError"), variant: "destructive" });
        },
      },
    );
  }

  const isPending = bulkRegister.isPending;

  function renderSummary() {
    const parts = [
      { key: "ready", count: batch.counts.ready },
      { key: "registered", count: batch.counts.registered },
      { key: "duplicate", count: batch.counts.duplicate },
      { key: "invalid", count: batch.counts.invalid },
    ].filter((part) => part.count > 0);

    return (
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {overCap
          ? t("iot.devices.bulkDialog.overCap", { count: batch.counts.ready })
          : parts.length === 0
            ? t("iot.devices.bulkDialog.serialsHint")
            : parts
                .map((part) =>
                  t(`iot.devices.bulkDialog.summary.${part.key}`, { count: part.count }),
                )
                .join(" · ")}
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("iot.devices.bulkDialog.title")}</DialogTitle>
          <DialogDescription>{t("iot.devices.bulkDialog.description")}</DialogDescription>
        </DialogHeader>

        {result !== null ? (
          <>
            <BulkRegisterResults result={result} />
            <DialogFooter>
              <Button onClick={closeAndReset}>{t("iot.devices.bulkDialog.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="deviceType"
                disabled={isPending}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("iot.devices.dialog.typeLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isPending}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("iot.devices.dialog.typePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {zRegisterableDeviceType.options.map((value) => (
                          <SelectItem key={value} value={value}>
                            {getSensorFamilyLabel(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serials"
                disabled={isPending}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("iot.devices.bulkDialog.serialsLabel")}</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        {t("iot.devices.bulkDialog.importFile")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,text/plain,text/csv"
                        className="hidden"
                        aria-label={t("iot.devices.bulkDialog.importFile")}
                        onChange={handleFilePicked}
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        rows={5}
                        placeholder={t("iot.devices.bulkDialog.serialsPlaceholder")}
                        className="font-mono"
                        onDrop={handleDrop}
                        {...field}
                      />
                    </FormControl>
                    {renderSummary()}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {batch.rows.length > 0 && <BulkRegisterPreview batch={batch} />}

              <FormField
                control={form.control}
                name="groupMode"
                disabled={isPending}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("iot.devices.bulkDialog.groupLabel")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex flex-wrap gap-4"
                      >
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value="none" />
                          {t("iot.devices.bulkDialog.groupNone")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value="existing" />
                          {t("iot.devices.bulkDialog.groupExisting")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value="new" />
                          {t("iot.devices.bulkDialog.groupNew")}
                        </label>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {groupMode === "existing" && (
                <FormField
                  control={form.control}
                  name="groupId"
                  disabled={isPending}
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("iot.devices.bulkDialog.groupSelectPlaceholder")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(groups ?? []).map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {groupMode === "new" && (
                <FormField
                  control={form.control}
                  name="groupName"
                  disabled={isPending}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t("iot.devices.bulkDialog.groupNamePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAndReset}
                  disabled={isPending}
                >
                  {tCommon("common.cancel")}
                </Button>
                <Button type="submit" disabled={isPending || !canSubmit}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("iot.devices.bulkDialog.submit", { count: batch.counts.ready })}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
