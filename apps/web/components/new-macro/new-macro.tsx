"use client";

import { useAddCompatibleCommand } from "@/hooks/macro/useAddCompatibleCommand/useAddCompatibleCommand";
import { useMacroCreate } from "@/hooks/macro/useMacroCreate/useMacroCreate";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { encodeBase64 } from "@/util/base64";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

import type { Command } from "@repo/api/schemas/command.schema";
import type { CreateMacroRequestBody } from "@repo/api/schemas/macro.schema";
import { zCreateMacroRequestBody } from "@repo/api/schemas/macro.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useCommandSearch } from "../../hooks/command/useCommandSearch/useCommandSearch";
import { CommandSearchWithDropdown } from "../command-search-with-dropdown";
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

  // Selected commands (local state before macro creation)
  const [selectedCommands, setSelectedCommands] = useState<Command[]>([]);

  // Command search
  const [commandSearch, setCommandSearch] = useState("");
  const [debouncedCommandSearch, isDebounced] = useDebounce(commandSearch, 300);
  const { commands: commandList } = useCommandSearch(debouncedCommandSearch || undefined);

  const addCommandsMutationRef = useRef<ReturnType<typeof useAddCompatibleCommand>>(null);

  const { mutate: createMacro, isPending } = useMacroCreate({
    onSuccess: (data) => {
      const id = data.body.id;
      // Link selected commands after macro creation, then redirect
      if (selectedCommands.length > 0 && addCommandsMutationRef.current) {
        addCommandsMutationRef.current
          .mutateAsync({
            params: { id },
            body: { commandIds: selectedCommands.map((p) => p.id) },
          })
          .catch(() => {
            // Macro was created successfully, command linking failed - still redirect
          })
          .finally(() => {
            router.push(`/${locale}/platform/macros/${id}`);
          });
        return;
      }
      router.push(`/${locale}/platform/macros/${id}`);
    },
  });

  // Placeholder macroId for the hook - actual call uses real ID via mutateAsync
  const addCommandsMutation = useAddCompatibleCommand("");
  addCommandsMutationRef.current = addCommandsMutation;

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
  }

  const selectedCommandIds = useMemo(
    () => new Set(selectedCommands.map((p) => p.id)),
    [selectedCommands],
  );

  const availableCommands: Command[] = useMemo(
    () => (commandList ?? []).filter((p) => !selectedCommandIds.has(p.id)),
    [commandList, selectedCommandIds],
  );

  const handleAddCommand = (commandId: string) => {
    const command = commandList?.find((p) => p.id === commandId);
    if (command) {
      setSelectedCommands((prev) =>
        [...prev, command].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCommandSearch("");
    }
  };

  const handleRemoveCommand = (commandId: string) => {
    setSelectedCommands((prev) => prev.filter((p) => p.id !== commandId));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Details row: name/description + language + compatible commands */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex-1">
            <NewMacroDetailsCard form={form} />
          </div>

          <div className="w-full space-y-4 md:w-72">
            {/* Programming Language */}
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
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

            {/* Compatible Commands */}
            <div className="space-y-2">
              <CommandSearchWithDropdown
                availableCommands={availableCommands}
                value=""
                placeholder={t("newMacro.compatibleCommands")}
                loading={!isDebounced}
                searchValue={commandSearch}
                onSearchChange={setCommandSearch}
                onAddCommand={handleAddCommand}
                isAddingCommand={false}
              />

              {selectedCommands.length > 0 && (
                <div className="space-y-2">
                  {selectedCommands.map((command) => (
                    <div
                      key={command.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{command.name}</span>
                        <span className="text-muted-foreground text-xs">{command.family}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRemoveCommand(command.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Editor - full width */}
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
                username={`${userProfile?.body.firstName} ${userProfile?.body.lastName}`}
                label=""
                error={form.formState.errors.code?.message?.toString()}
                height="500px"
                title={t("newMacro.codeTitle")}
              />
            )}
          />
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={cancel}>
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
