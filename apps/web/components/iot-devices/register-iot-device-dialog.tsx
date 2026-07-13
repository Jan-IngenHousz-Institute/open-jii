"use client";

import { useRegisterIotDevice } from "@/hooks/iot/useRegisterIotDevice/useRegisterIotDevice";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { zSensorFamily } from "@repo/api/schemas/command.schema";
import { zRegisterIotDeviceBody } from "@repo/api/schemas/iot.schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

// Name stays optional without the contract's min(1) so an empty field is valid in the form;
// it is stripped before submit.
const registerIotDeviceFormSchema = zRegisterIotDeviceBody.extend({
  name: z.string().max(255).optional(),
});

type RegisterIotDeviceFormValues = z.infer<typeof registerIotDeviceFormSchema>;

interface RegisterIotDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterIotDeviceDialog({ open, onOpenChange }: RegisterIotDeviceDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");

  const form = useForm<RegisterIotDeviceFormValues>({
    resolver: zodResolver(registerIotDeviceFormSchema),
    defaultValues: { serialNumber: "", deviceType: undefined, name: "" },
  });

  const { mutate: registerIotDevice, isPending } = useRegisterIotDevice({
    onSuccess: () => {
      toast({
        title: t("iot.devices.dialog.createSuccess"),
        description: t("iot.devices.dialog.createSuccessDetail"),
      });
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (values: RegisterIotDeviceFormValues) => {
    const name = values.name?.trim();
    registerIotDevice(
      {
        body: {
          serialNumber: values.serialNumber,
          deviceType: values.deviceType,
          ...(name ? { name } : {}),
        },
      },
      {
        onError: () => {
          toast({ title: t("iot.devices.dialog.createError"), variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("iot.devices.dialog.title")}</DialogTitle>
          <DialogDescription>{t("iot.devices.dialog.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serialNumber"
              disabled={isPending}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iot.devices.dialog.serialLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("iot.devices.dialog.serialPlaceholder")}
                      {...field}
                      trim
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {zSensorFamily.options.map((value) => (
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
              name="name"
              disabled={isPending}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iot.devices.dialog.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("iot.devices.dialog.namePlaceholder")}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {tCommon("common.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("iot.devices.dialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
