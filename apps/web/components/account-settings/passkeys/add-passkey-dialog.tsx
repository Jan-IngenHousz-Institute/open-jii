"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAddPasskey } from "~/hooks/auth/useAddPasskey/useAddPasskey";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from "@repo/ui/hooks/use-toast";

export function AddPasskeyDialog() {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const addPasskey = useAddPasskey();

  const formSchema = z.object({
    name: z.string().min(1, t("passkeys.nameRequired")),
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const handleClose = () => {
    setOpen(false);
    form.reset();
  };

  const onSubmit = async (data: FormData) => {
    try {
      await addPasskey.mutateAsync({ name: data.name });
      toast({ description: t("passkeys.added") });
      handleClose();
    } catch {
      // Covers WebAuthn ceremony cancellation too; keep the dialog open for retry.
      toast({ description: t("passkeys.addError"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("passkeys.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("passkeys.addTitle")}</DialogTitle>
          <DialogDescription>{t("passkeys.addDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("passkeys.name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("passkeys.namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("passkeys.cancel")}
              </Button>
              <Button type="submit" disabled={addPasskey.isPending}>
                {addPasskey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("passkeys.addConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
