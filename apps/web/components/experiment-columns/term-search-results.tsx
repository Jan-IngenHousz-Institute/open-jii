"use client";

import { useExperimentColumnTermSearch } from "@/hooks/experiment/useExperimentColumnTermSearch/useExperimentColumnTermSearch";
import { Check } from "lucide-react";

import type { ColumnTerm } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { CommandGroup, CommandItem } from "@repo/ui/components/command";
import { cn } from "@repo/ui/lib/utils";

interface TermSearchResultsProps {
  search: string;
  selectedId: string | null;
  unreachableMessage: string;
  onSelect: (term: ColumnTerm) => void;
}

/** One search across every vocabulary, grouped under the vocabulary each term comes from. */
export function TermSearchResults({
  search,
  selectedId,
  unreachableMessage,
  onSelect,
}: TermSearchResultsProps) {
  const { t } = useTranslation("studyMetadata");
  const { data, isFetching, isError } = useExperimentColumnTermSearch(search);

  const hasQuery = search.trim().length >= 2;
  const terms = hasQuery ? (data?.terms ?? []) : [];
  const unreachable = hasQuery ? (data?.unreachable ?? []) : [];
  const isSearching = hasQuery && isFetching;
  const hasNoMatch = hasQuery && !isFetching && !isError && terms.length === 0;
  const isPartlyAnswered = unreachable.length > 0;
  const vocabularies = [...new Set(terms.map((term) => term.vocabulary))];

  const renderTerm = (term: ColumnTerm) => (
    <CommandItem
      key={`${term.vocabulary} ${term.id}`}
      value={`${term.vocabulary} ${term.id}`}
      onSelect={() => onSelect(term)}
    >
      <Check
        className={cn("size-4 shrink-0", selectedId === term.id ? "opacity-100" : "opacity-0")}
      />
      <div className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate">{term.label}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs">{term.id}</span>
        </span>
        {term.definition && (
          <span className="text-muted-foreground line-clamp-2 block text-xs">
            {term.definition}
          </span>
        )}
      </div>
    </CommandItem>
  );

  const renderVocabulary = (vocabulary: string) => (
    <CommandGroup key={vocabulary} heading={vocabulary}>
      {terms.filter((term) => term.vocabulary === vocabulary).map(renderTerm)}
    </CommandGroup>
  );

  return (
    <>
      {!hasQuery && (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">
          {t("describe.term.hint")}
        </p>
      )}
      {isSearching && (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">
          {t("describe.term.searching")}
        </p>
      )}
      {isError && (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">{unreachableMessage}</p>
      )}
      {hasNoMatch && (
        <p className="text-muted-foreground px-3 py-4 text-center text-sm">
          {t("describe.term.noMatches")}
        </p>
      )}
      {isPartlyAnswered && (
        <p className="text-muted-foreground px-3 pt-3 text-xs">
          {t("describe.term.partlyUnreachable", { sources: unreachable.join(", ") })}
        </p>
      )}
      {vocabularies.map(renderVocabulary)}
    </>
  );
}
