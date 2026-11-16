"use client";

import { DiscardChangesDialog } from "@/components/shared/discard-changes-dialog";
import { useExperimentColumnDescribe } from "@/hooks/experiment/useExperimentColumnDescribe/useExperimentColumnDescribe";
import { useExperimentColumnSuggestion } from "@/hooks/experiment/useExperimentColumnSuggestion/useExperimentColumnSuggestion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { parseApiError } from "~/util/apiError";

import type {
  ColumnDescription,
  ColumnProcessingLevel,
  ColumnProducer,
  ColumnValueKind,
  DescribeColumnBody,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { zDescribeColumnBody } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Form } from "@repo/ui/components/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { toast } from "@repo/ui/hooks/use-toast";

import { ColumnDescribeFields } from "./column-describe-fields";
import { ColumnDescribeFooter } from "./column-describe-footer";
import type { SuggestedDescription } from "./column-suggestion-banner";
import type { DictionaryEntry, DictionaryFilter, DictionaryView } from "./dictionary-view";
import { useProducerText } from "./use-producer-text";

const STARTING_PROCESSING_LEVELS: Partial<Record<ColumnProducer["kind"], ColumnProcessingLevel>> = {
  instrument: "measured",
  upload: "measured",
  macro: "computed",
};

function startingValueKind(type: string): ColumnValueKind | null {
  if (isNumericType(type)) {
    return "number";
  }
  return type === "STRING" ? "text" : null;
}

/** What an undescribed column starts from: its method, kind of value and processing level. */
function startingDescription(entry: DictionaryEntry, method: string | null): ColumnDescription {
  return {
    definition: "",
    property: "",
    propertyTerm: null,
    noTermFits: false,
    objectOfInterest: null,
    objectOfInterestTerm: null,
    context: null,
    contextTerm: null,
    method,
    unit: null,
    valueKind: startingValueKind(entry.column.type),
    processingLevel: STARTING_PROCESSING_LEVELS[entry.producer.kind] ?? null,
  };
}

interface ColumnDescribeDrawerProps {
  experimentId: string;
  view: DictionaryView;
  filter: DictionaryFilter;
  selected: DictionaryEntry | null;
  canDescribe: boolean;
  onSelect: (entry: DictionaryEntry) => void;
  onClose: () => void;
}

/** Records what one column measures: its definition, the property and what it is a property of. */
export function ColumnDescribeDrawer({
  experimentId,
  view,
  filter,
  selected,
  canDescribe,
  onSelect,
  onClose,
}: ColumnDescribeDrawerProps) {
  const { t } = useTranslation("studyMetadata");
  const producerText = useProducerText();
  const { mutateAsync: describeColumn, isPending } = useExperimentColumnDescribe();
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [appliedIdentity, setAppliedIdentity] = useState<string | null>(null);

  // react-hook-form resets only when `values` differs from the last `values` it was given, so the
  // identity keeps two undescribed columns from sharing one form.
  const values: DescribeColumnBody | undefined = selected
    ? {
        column: selected.column.identity,
        ...(selected.column.description ??
          startingDescription(selected, producerText(selected.producer).method)),
      }
    : undefined;
  const form = useForm<DescribeColumnBody>({
    resolver: zodResolver(zDescribeColumnBody),
    values,
  });
  const isDirty = form.formState.isDirty;

  const earlier = selected ? view.earlierDescription(selected) : null;
  const isUndescribed = selected !== null && selected.column.description === null;
  const shouldAskOtherExperiments = canDescribe && isUndescribed && earlier === null;
  const { data: others } = useExperimentColumnSuggestion(
    experimentId,
    selected?.column.identity ?? "",
    shouldAskOtherExperiments,
  );

  const suggestionFor = (entry: DictionaryEntry): SuggestedDescription | null => {
    if (earlier) {
      return {
        description: earlier.description,
        reason: { kind: "earlier-version", workbookVersion: earlier.workbookVersion },
      };
    }
    if (others && isUndescribed) {
      return {
        description: others.description,
        reason: {
          kind: "other-experiments",
          count: others.experimentCount,
          origin: entry.producer.kind === "macro" ? "macro" : "instrument",
        },
      };
    }
    return null;
  };

  const save = (afterSave: () => void) => async (body: DescribeColumnBody) => {
    await describeColumn(
      { id: experimentId, ...body },
      {
        onSuccess: () => {
          toast({ description: t("describe.saved") });
          afterSave();
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      return;
    }
    if (isDirty) {
      setIsDiscardOpen(true);
    } else {
      onClose();
    }
  };

  const handleCancel = () => handleOpenChange(false);

  const handleKeepEditing = () => setIsDiscardOpen(false);

  const handleDiscard = () => {
    form.reset();
    setIsDiscardOpen(false);
    onClose();
  };

  const handleUseSuggestion = (entry: DictionaryEntry) => (suggestion: SuggestedDescription) => {
    form.reset(
      { column: entry.column.identity, ...suggestion.description },
      { keepDefaultValues: true },
    );
    setAppliedIdentity(entry.column.identity);
  };

  const renderPanel = (entry: DictionaryEntry) => {
    const suggestion = suggestionFor(entry);
    const next = view.nextToDo(entry, filter);
    const handleSave = form.handleSubmit(save(onClose));
    const handleSaveAndNext = form.handleSubmit(save(() => (next ? onSelect(next) : onClose())));

    return (
      <>
        <SheetHeader className="border-border border-b px-6 py-4">
          <SheetTitle className="font-mono">{entry.column.name}</SheetTitle>
          <SheetDescription>{producerText(entry.producer).title}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <ColumnDescribeFields
              form={form}
              canDescribe={canDescribe}
              suggestion={suggestion}
              isSuggestionApplied={appliedIdentity === entry.column.identity}
              onUseSuggestion={handleUseSuggestion(entry)}
            />
            <ColumnDescribeFooter
              canDescribe={canDescribe}
              hasNext={next !== null}
              isPending={isPending}
              onCancel={handleCancel}
              onSaveAndNext={handleSaveAndNext}
            />
          </form>
        </Form>
      </>
    );
  };

  return (
    <>
      <Sheet open={selected !== null} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
          {selected && renderPanel(selected)}
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog
        open={isDiscardOpen}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscard}
      />
    </>
  );
}
