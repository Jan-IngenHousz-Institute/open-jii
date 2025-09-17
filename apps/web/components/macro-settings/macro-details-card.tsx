"use client";

import { editMacroFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";

import type { UpdateMacroRequestBody, MacroLanguage } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RichTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useMacroUpdate } from "../../hooks/macro/useMacroUpdate/useMacroUpdate";
import MacroCodeEditor from "../macro-code-editor";

interface MacroDetailsCardProps {
  macroId: string;
  initialName: string;
  initialDescription: string;
  initialCode: string;
  initialLanguage: MacroLanguage;
}

export function MacroDetailsCard({
  macroId,
  initialName,
  initialDescription,
  initialCode,
  initialLanguage,
}: MacroDetailsCardProps) {
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(macroId);
  const { t } = useTranslation();

  const form = useForm<UpdateMacroRequestBody & { name: string; language: MacroLanguage }>({
    resolver: zodResolver(
      editMacroFormSchema.pick({ name: true, description: true, language: true, code: true }),
    ),
    defaultValues: {
      name: initialName,
      description: initialDescription,
      code: initialCode,
      language: initialLanguage,
    },
  });

  async function onSubmit(
    data: UpdateMacroRequestBody & { name: string; language: MacroLanguage },
  ) {
    await updateMacro({
      params: { id: macroId },
      body: data,
    });
    toast({ description: t("macros.macroUpdated") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.generalSettings")}</CardTitle>
        <CardDescription>{t("macroSettings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("macroSettings.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} trim placeholder={t("macroSettings.name")} />
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
                  <FormLabel>{t("macroSettings.description")}</FormLabel>
                  <FormControl>
                    <RichTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={t("macroSettings.description")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("macroSettings.language")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t("macroSettings.code")}</h3>
              <p className="text-muted-foreground text-sm">{t("macroSettings.codeDescription")}</p>
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MacroCodeEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        language={form.watch("language")}
                        macroName={form.watch("name")}
                        label=""
                        error={form.formState.errors.code?.message?.toString()}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t("macroSettings.saving") : t("macroSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
