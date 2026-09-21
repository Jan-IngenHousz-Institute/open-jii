"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, FilePenLine, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type {
  AssistantDraft,
  AssistantDraftPayload,
} from "@repo/api/domains/assistant/assistant.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Separator } from "@repo/ui/components/separator";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

function labelFor(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return `${value}`;
  if (typeof value === "object") return JSON.stringify(value);
  return "Not set";
}

function coerceValue(value: string, original: unknown): unknown {
  if (typeof original === "number") {
    const number = Number(value);
    return Number.isNaN(number) ? original : number;
  }
  if (typeof original === "boolean") return value === "true";
  return value;
}

function isMultilineField(field: string, value: unknown): value is string {
  return typeof value === "string" && (field === "code" || field === "description");
}

export function AssistantDraftCard({ draft }: { draft: AssistantDraft }) {
  const { t } = useTranslation("assistant");
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [invalidFields, setInvalidFields] = React.useState<Set<string>>(() => new Set());
  const [value, setValue] = React.useState<Record<string, unknown>>(() => ({
    ...draft.payload.value,
  }));

  React.useEffect(() => {
    setValue({ ...draft.payload.value });
  }, [draft.payload.value]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.assistant.getThread.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.assistant.listThreads.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.assistant.getUsage.key() }),
    ]);
  };

  const update = useMutation(
    orpc.assistant.updateDraft.mutationOptions({
      onSuccess: async () => {
        setEditing(false);
        await invalidate();
      },
    }),
  );
  const confirm = useMutation(
    orpc.assistant.confirmDraft.mutationOptions({ onSuccess: invalidate }),
  );
  const discard = useMutation(
    orpc.assistant.discardDraft.mutationOptions({ onSuccess: invalidate }),
  );

  const busy = update.isPending || confirm.isPending || discard.isPending;
  const pending = draft.status === "pending";
  const canRetryConfirmation = draft.status === "confirming" && draft.createdEntity !== null;

  const save = () => {
    if (invalidFields.size > 0) return;
    const payload = { kind: draft.kind, value } as AssistantDraftPayload;
    update.mutate({ draftId: draft.id, payload });
  };

  const entries = Object.entries(value)
    .filter(([field]) => field !== "codeEncoding")
    .sort(([left], [right]) => {
      if (draft.kind !== "visualization") return 0;
      if (left === "experimentId") return -1;
      if (right === "experimentId") return 1;
      return 0;
    });

  return (
    <Card className="border-primary/20 gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="bg-muted/40 flex flex-row items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm">
            {t("draft.title", { type: t(`entity.${draft.kind}`) })}
          </CardTitle>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t(`draft.description.${draft.status}`)}
          </p>
        </div>
        <Badge variant={draft.status === "confirmed" ? "default" : "secondary"}>
          {t(`draft.status.${draft.status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4">
        {draft.source && (
          <div className="text-muted-foreground text-xs">
            {t("draft.basedOn")} <span className="text-foreground">{draft.source.title}</span>
          </div>
        )}

        {draft.kind === "visualization" && typeof value.experimentId === "string" && (
          <div className="border-primary/20 bg-primary/5 rounded-lg border px-3 py-2 text-xs">
            <span className="text-muted-foreground block">
              {t("draft.visualization.destination")}
            </span>
            <span className="mt-0.5 block break-all font-mono">{value.experimentId}</span>
          </div>
        )}

        <dl className="space-y-2">
          {entries.map(([field, fieldValue]) => {
            if (draft.kind === "visualization" && field === "experimentId") return null;
            const fieldLabel =
              draft.kind === "visualization"
                ? t(`draft.visualization.fields.${field}`)
                : labelFor(field);
            const editable =
              editing &&
              fieldValue !== null &&
              (typeof fieldValue === "string" ||
                typeof fieldValue === "number" ||
                typeof fieldValue === "boolean");
            const multiline = isMultilineField(field, fieldValue);
            return (
              <div key={field} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-xs">
                <dt className="text-muted-foreground pt-2">{fieldLabel}</dt>
                <dd className="min-w-0">
                  {editable ? (
                    multiline ? (
                      <Textarea
                        aria-label={fieldLabel}
                        className={cn(
                          "font-mono text-xs",
                          field === "code"
                            ? "min-h-40 overflow-x-auto whitespace-pre"
                            : "min-h-28 whitespace-pre-wrap",
                        )}
                        wrap={field === "code" ? "off" : undefined}
                        value={fieldValue}
                        onChange={(event) =>
                          setValue((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <Input
                        aria-label={fieldLabel}
                        className="h-8 text-xs"
                        value={String(fieldValue)}
                        onChange={(event) =>
                          setValue((current) => ({
                            ...current,
                            [field]: coerceValue(event.target.value, fieldValue),
                          }))
                        }
                      />
                    )
                  ) : editing && fieldValue !== null && typeof fieldValue === "object" ? (
                    <div className="space-y-1">
                      <Textarea
                        aria-label={fieldLabel}
                        className="min-h-28 font-mono text-xs"
                        defaultValue={JSON.stringify(fieldValue, null, 2)}
                        onChange={(event) => {
                          try {
                            const parsed = JSON.parse(event.target.value) as unknown;
                            setValue((current) => ({ ...current, [field]: parsed }));
                            setInvalidFields((current) => {
                              const next = new Set(current);
                              next.delete(field);
                              return next;
                            });
                          } catch {
                            setInvalidFields((current) => new Set(current).add(field));
                          }
                        }}
                      />
                      {invalidFields.has(field) && (
                        <span className="text-destructive" role="alert">
                          {t("draft.invalidJson")}
                        </span>
                      )}
                    </div>
                  ) : multiline ? (
                    <pre
                      className={cn(
                        "block font-mono text-xs",
                        field === "code"
                          ? "bg-muted/40 max-h-64 overflow-x-auto overflow-y-auto whitespace-pre rounded-md p-2"
                          : "whitespace-pre-wrap break-words py-2",
                      )}
                    >
                      {fieldValue}
                    </pre>
                  ) : (
                    <span
                      className={cn(
                        "block break-words py-2",
                        fieldValue !== null &&
                          typeof fieldValue === "object" &&
                          "bg-muted/40 max-h-44 overflow-auto whitespace-pre-wrap rounded-md p-2 font-mono",
                      )}
                    >
                      {fieldValue !== null && typeof fieldValue === "object"
                        ? JSON.stringify(fieldValue, null, 2)
                        : displayValue(fieldValue)}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        {draft.status === "confirmed" && draft.createdEntity && (
          <>
            <Separator />
            <Button asChild size="sm" className="w-full">
              <Link href={draft.createdEntity.url}>
                {t("draft.openCreated", { name: draft.createdEntity.name })}
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </>
        )}

        {pending && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setValue({ ...draft.payload.value });
                    setInvalidFields(new Set());
                    setEditing(false);
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  {t("draft.cancelEdit")}
                </Button>
                <Button size="sm" disabled={busy || invalidFields.size > 0} onClick={save}>
                  <Check className="size-3.5" />
                  {t("draft.saveChanges")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => discard.mutate({ draftId: draft.id })}
                >
                  <X className="size-3.5" />
                  {t("draft.discard")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setInvalidFields(new Set());
                    setEditing(true);
                  }}
                >
                  <FilePenLine className="size-3.5" />
                  {t("draft.edit")}
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => confirm.mutate({ draftId: draft.id })}
                >
                  <Check className="size-3.5" />
                  {t("draft.confirm", { type: t(`entity.${draft.kind}`) })}
                </Button>
              </>
            )}
          </div>
        )}

        {canRetryConfirmation && (
          <div className="space-y-2 pt-1">
            <p className="text-muted-foreground text-xs">{t("draft.retryConfirmationHelp")}</p>
            <Button
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() => confirm.mutate({ draftId: draft.id })}
            >
              <RotateCcw className="size-3.5" />
              {t("draft.retryConfirmation")}
            </Button>
          </div>
        )}

        {(update.isError || confirm.isError || discard.isError) && (
          <p role="alert" className="text-destructive text-xs">
            {t("draft.actionError")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
