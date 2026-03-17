"use client";

import { useAddCompatibleMacro } from "@/hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateProtocolRequestBody, Macro } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { tsr } from "../../lib/tsr";
import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";
import ProtocolCodeEditor from "../protocol-code-editor";
import { NewProtocolDetailsCard } from "./new-protocol-details-card";

export function NewProtocolForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const [isCodeValid, setIsCodeValid] = useState(true);

  // Selected macros (local state before protocol creation)
  const [selectedMacros, setSelectedMacros] = useState<Macro[]>([]);

  // Macro search
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroData } = tsr.macros.listMacros.useQuery({
    queryData: {
      query: { search: debouncedMacroSearch || undefined },
    },
    queryKey: ["macros", "search", debouncedMacroSearch],
  });
  const macroList = macroData?.body;

  const addMacrosMutationRef = useRef<ReturnType<typeof useAddCompatibleMacro>>(null);

  const { mutate: createProtocol, isPending } = useProtocolCreate({
    onSuccess: (id: string) => {
      // Link selected macros after protocol creation, then redirect
      if (selectedMacros.length > 0 && addMacrosMutationRef.current) {
        addMacrosMutationRef.current
          .mutateAsync({
            params: { id },
            body: { macroIds: selectedMacros.map((m) => m.id) },
          })
          .catch(() => {
            // Protocol was created successfully, macro linking failed - still redirect
          })
          .finally(() => {
            router.push(`/${locale}/platform/protocols/${id}`);
          });
        return;
      }
      router.push(`/${locale}/platform/protocols/${id}`);
    },
  });

  // Placeholder protocolId for the hook - actual call uses the real ID via mutateAsync
  const addMacrosMutation = useAddCompatibleMacro("");
  addMacrosMutationRef.current = addMacrosMutation;

  const form = useForm<CreateProtocolRequestBody>({
    resolver: zodResolver(zCreateProtocolRequestBody),
    defaultValues: {
      name: "",
      description: "",
      code: [{}],
      family: "multispeq",
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateProtocolRequestBody) {
    createProtocol({
      body: {
        name: data.name,
        description: data.description,
        code: data.code,
        family: data.family,
      },
    });
    toast({ description: t("protocols.protocolCreated") });
  }

  const selectedMacroIds = useMemo(
    () => new Set(selectedMacros.map((m) => m.id)),
    [selectedMacros],
  );

  const availableMacros: Macro[] = useMemo(
    () => (macroList ?? []).filter((m) => !selectedMacroIds.has(m.id)),
    [macroList, selectedMacroIds],
  );

  const handleAddMacro = (macroId: string) => {
    const macro = macroList?.find((m) => m.id === macroId);
    if (macro) {
      setSelectedMacros((prev) => [...prev, macro]);
      setMacroSearch("");
    }
  };

  const handleRemoveMacro = (macroId: string) => {
    setSelectedMacros((prev) => prev.filter((m) => m.id !== macroId));
  };

  const isDisabled = useMemo(() => {
    return isPending || !form.formState.isDirty || !form.formState.isValid || !isCodeValid;
  }, [isPending, form.formState.isDirty, form.formState.isValid, isCodeValid]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Details row: name/description + family + compatible macros */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex-1">
            <NewProtocolDetailsCard form={form} />
          </div>

          <div className="w-full space-y-4 md:w-72">
            {/* Sensor Family */}
            <FormField
              control={form.control}
              name="family"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("newProtocol.selectFamily")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="multispeq">MultispeQ</SelectItem>
                      <SelectItem value="ambit">Ambit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Compatible Macros */}
            <div className="space-y-2">
              <MacroSearchWithDropdown
                availableMacros={availableMacros}
                value=""
                placeholder={t("newProtocol.compatibleMacros")}
                loading={!isDebounced}
                searchValue={macroSearch}
                onSearchChange={setMacroSearch}
                onAddMacro={handleAddMacro}
                isAddingMacro={false}
              />

              {selectedMacros.length > 0 && (
                <div className="space-y-2">
                  {selectedMacros.map((macro) => (
                    <div
                      key={macro.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{macro.name}</span>
                        <span className="text-muted-foreground text-xs">{macro.language}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRemoveMacro(macro.id)}
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
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <ProtocolCodeEditor
              value={field.value}
              onChange={field.onChange}
              onValidationChange={setIsCodeValid}
              label=""
              placeholder={t("newProtocol.codePlaceholder")}
              error={form.formState.errors.code?.message?.toString()}
              title={t("newProtocol.codeTitle")}
            />
          )}
        />

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={cancel}>
            {t("newProtocol.cancel")}
          </Button>
          <Button type="submit" disabled={isDisabled}>
            {isPending ? t("newProtocol.creating") : t("newProtocol.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
