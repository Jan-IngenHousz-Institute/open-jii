"use client";

import { useMacroCreate } from "@/hooks/macro/useMacroCreate/useMacroCreate";
import { useLocale } from "@/hooks/useLocale";
import { encodeBase64 } from "@/util/base64";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

import type { CreateMacroRequestBody } from "@repo/api";
import { zCreateMacroRequestBody } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import MacroCodeEditor from "../macro-code-editor";
import { NewMacroDetailsCard } from "./new-macro-details-card";

export function NewMacroForm() {
  const router = useRouter();
  const { t } = useTranslation("macro");
  const locale = useLocale();
  const { data: session } = useSession();
  const { data: userProfile, isLoading: isLoadingUserProfile } = useGetUserProfile(
    session?.user.id ?? "",
  );

  const { mutate: createMacro, isPending } = useMacroCreate({
    onSuccess: (id: string) => router.push(`/${locale}/platform/macros/${id}`),
  });

  const form = useForm<CreateMacroRequestBody>({
    resolver: zodResolver(zCreateMacroRequestBody),
    defaultValues: {
      name: "",
      description: "",
      language: "python",
      code: "",
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateMacroRequestBody) {
    // Convert the code to base64 for transmission
    const code = encodeBase64(data.code);

    createMacro({
      body: {
        name: data.name,
        description: data.description,
        language: data.language,
        code: code,
      },
    });
    toast({ description: t("macros.macroCreated") });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <NewMacroDetailsCard form={form} />

        <div className="space-y-2">
          <h3 className="text-lg font-medium">{t("newMacro.codeTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("newMacro.codeDescription")}</p>
          <div className="space-y-4 rounded-md border p-4">
            {/* Programming Language */}
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("newMacro.language")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("newMacro.selectLanguage")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="r">R</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Code Editor with Loading State */}
            {isLoadingUserProfile ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-[500px] w-full" />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <MacroCodeEditor
                    value={field.value}
                    onChange={field.onChange}
                    language={form.watch("language")}
                    macroName={form.watch("name")}
                    username={`${userProfile?.body.firstName} ${userProfile?.body.lastName}`}
                    label={t("newMacro.code")}
                    error={form.formState.errors.code?.message?.toString()}
                    height="500px"
                  />
                )}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={cancel}>
            {t("newMacro.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("newMacro.creating") : t("newMacro.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
