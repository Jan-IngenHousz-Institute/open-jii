"use client";

import { useAddCompatibleProtocol } from "@/hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol";
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

import type { CreateMacroRequestBody, Protocol } from "@repo/api";
import { zCreateMacroRequestBody } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@repo/ui/components";

import { useProtocolSearch } from "../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import MacroCodeEditor from "../macro-code-editor";
import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";
import { NewMacroDetailsCard } from "./new-macro-details-card";

export function NewMacroForm() {
  const router = useRouter();
  const { t } = useTranslation("macro");
  const locale = useLocale();
  const { data: session } = useSession();
  const { data: userProfile, isLoading: isLoadingUserProfile } = useGetUserProfile(
    session?.user.id ?? "",
  );

  // Selected protocols (local state before macro creation)
  const [selectedProtocols, setSelectedProtocols] = useState<Protocol[]>([]);

  // Protocol search
  const [protocolSearch, setProtocolSearch] = useState("");
  const [debouncedProtocolSearch, isDebounced] = useDebounce(protocolSearch, 300);
  const { protocols: protocolList } = useProtocolSearch(debouncedProtocolSearch || undefined);

  const addProtocolsMutationRef = useRef<ReturnType<typeof useAddCompatibleProtocol>>(null);

  const { mutate: createMacro, isPending } = useMacroCreate({
    onSuccess: (data) => {
      const id = data.body.id;
      // Link selected protocols after macro creation, then redirect
      if (selectedProtocols.length > 0 && addProtocolsMutationRef.current) {
        addProtocolsMutationRef.current
          .mutateAsync({
            params: { id },
            body: { protocolIds: selectedProtocols.map((p) => p.id) },
          })
          .catch(() => {
            // Macro was created successfully, protocol linking failed - still redirect
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
  const addProtocolsMutation = useAddCompatibleProtocol("");
  addProtocolsMutationRef.current = addProtocolsMutation;

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

  const selectedProtocolIds = useMemo(
    () => new Set(selectedProtocols.map((p) => p.id)),
    [selectedProtocols],
  );

  const availableProtocols: Protocol[] = useMemo(
    () => (protocolList ?? []).filter((p) => !selectedProtocolIds.has(p.id)),
    [protocolList, selectedProtocolIds],
  );

  const handleAddProtocol = (protocolId: string) => {
    const protocol = protocolList?.find((p) => p.id === protocolId);
    if (protocol) {
      setSelectedProtocols((prev) =>
        [...prev, protocol].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setProtocolSearch("");
    }
  };

  const handleRemoveProtocol = (protocolId: string) => {
    setSelectedProtocols((prev) => prev.filter((p) => p.id !== protocolId));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Details row: name/description + language + compatible protocols */}
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
                      <SelectItem value="r" disabled>
                        R
                      </SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Compatible Protocols */}
            <div className="space-y-2">
              <ProtocolSearchWithDropdown
                availableProtocols={availableProtocols}
                value=""
                placeholder={t("newMacro.compatibleProtocols")}
                loading={!isDebounced}
                searchValue={protocolSearch}
                onSearchChange={setProtocolSearch}
                onAddProtocol={handleAddProtocol}
                isAddingProtocol={false}
              />

              {selectedProtocols.length > 0 && (
                <div className="space-y-2">
                  {selectedProtocols.map((protocol) => (
                    <div
                      key={protocol.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{protocol.name}</span>
                        <span className="text-muted-foreground text-xs">{protocol.family}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRemoveProtocol(protocol.id)}
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

        {/* Code Editor — full width */}
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
