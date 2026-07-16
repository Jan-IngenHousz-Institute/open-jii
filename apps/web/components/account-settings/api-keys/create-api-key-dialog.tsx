"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateApiKey } from "~/hooks/auth/useCreateApiKey/useCreateApiKey";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

const DAY_SECONDS = 60 * 60 * 24;
const EXPIRATION_OPTIONS = ["30", "90", "365", "never"] as const;

export function CreateApiKeyDialog() {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createApiKey = useCreateApiKey();

  const formSchema = z.object({
    name: z.string().min(1, t("apiKeys.nameRequired")),
    expiration: z.enum(EXPIRATION_OPTIONS),
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", expiration: "never" },
  });

  const handleClose = () => {
    setOpen(false);
    setCreatedKey(null);
    setCopied(false);
    form.reset();
  };

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createApiKey.mutateAsync({
        name: data.name,
        expiresIn: data.expiration === "never" ? undefined : Number(data.expiration) * DAY_SECONDS,
      });
      setCreatedKey(result.key);
    } catch {
      toast({ description: t("apiKeys.createError"), variant: "destructive" });
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("apiKeys.create")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiKeys.createdTitle")}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <TriangleAlert className="text-destructive h-4 w-4 shrink-0" />
                {t("apiKeys.createdWarning")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 break-all rounded-md p-3 text-xs">
                {createdKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={t("apiKeys.copy")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>{t("apiKeys.done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiKeys.createTitle")}</DialogTitle>
              <DialogDescription>{t("apiKeys.createDescription")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("apiKeys.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("apiKeys.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("apiKeys.expiration")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPIRATION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(`apiKeys.expiration-${option}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    {t("apiKeys.cancel")}
                  </Button>
                  <Button type="submit" disabled={createApiKey.isPending}>
                    {createApiKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("apiKeys.createConfirm")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
