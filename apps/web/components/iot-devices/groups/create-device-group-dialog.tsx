"use client";

import { useCreateIotDeviceGroup } from "@/hooks/iot/useCreateIotDeviceGroup/useCreateIotDeviceGroup";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { zCreateIotDeviceGroupBody } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
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
import { Textarea } from "@repo/ui/components/textarea";

const formSchema = zCreateIotDeviceGroupBody.pick({ name: true, description: true });
type FormValues = z.infer<typeof formSchema>;

interface CreateDeviceGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
}

export function CreateDeviceGroupDialog({
  open,
  onOpenChange,
  locale,
}: CreateDeviceGroupDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const createGroup = useCreateIotDeviceGroup({
    onSuccess: (group) => {
      onOpenChange(false);
      form.reset();
      router.push(`/${locale}/platform/devices/groups/${group.id}`);
    },
  });

  function onSubmit(values: FormValues) {
    const description = values.description === "" ? undefined : values.description;
    createGroup.mutate({ name: values.name, description });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("iot.groups.createTitle")}</DialogTitle>
          <DialogDescription>{t("iot.groups.createDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iot.groups.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("iot.groups.namePlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iot.groups.descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                {tCommon("common.cancel")}
              </Button>
              <Button type="submit" disabled={createGroup.isPending}>
                {t("iot.groups.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
