"use client";

import { TermSearchResults } from "@/components/experiment-columns/term-search-results";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { ColumnTerm } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import type { StudySubject } from "@repo/api/domains/experiment/study/experiment-study.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import type { StudyDetailsFormValues } from "./study-details-form-schema";

const KEYWORD_VALUE = "__keyword__";

interface StudySubjectsFieldProps {
  form: UseFormReturn<StudyDetailsFormValues>;
}

/** Subjects as DataCite keeps them: terms from any vocabulary the term search covers, or keywords. */
export function StudySubjectsField({ form }: StudySubjectsFieldProps) {
  const { t } = useTranslation("studyMetadata");
  const subjects = useFieldArray({ control: form.control, name: "subjects" });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasSubjects = subjects.fields.length > 0;
  const keyword = search.trim();
  const canAddKeyword = keyword.length > 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
    }
  };

  const handleSelectTerm = (term: ColumnTerm) => {
    subjects.append({ label: term.label, term });
    handleOpenChange(false);
  };

  const handleAddKeyword = () => {
    subjects.append({ label: keyword, term: null });
    handleOpenChange(false);
  };

  const renderSubject = (subject: StudySubject & { id: string }, index: number) => (
    <li
      key={subject.id}
      className="bg-muted flex items-center gap-2 rounded-md py-1 pl-2.5 pr-1 text-sm"
      title={subject.term?.vocabulary}
    >
      <span>{subject.label}</span>
      <span className="text-muted-foreground font-mono text-xs">
        {subject.term ? subject.term.id : t("subjects.keyword")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={t("subjects.remove", { label: subject.label })}
        onClick={() => subjects.remove(index)}
      >
        <X className="size-3.5" />
      </Button>
    </li>
  );

  return (
    <div className="space-y-2">
      <p id="study-subjects-label" className="text-sm font-medium">
        {t("subjects.label")}
      </p>
      {hasSubjects ? (
        <ul aria-labelledby="study-subjects-label" className="flex flex-wrap gap-2">
          {subjects.fields.map(renderSubject)}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("subjects.empty")}</p>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-expanded={open}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("subjects.add")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("subjects.searchPlaceholder")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <TermSearchResults
                search={search}
                selectedId={null}
                unreachableMessage={t("subjects.unreachable")}
                onSelect={handleSelectTerm}
              />
              {canAddKeyword && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem value={KEYWORD_VALUE} onSelect={handleAddKeyword}>
                      <Plus className="size-4" />
                      <span className="truncate">{t("subjects.addKeyword", { keyword })}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-muted-foreground text-sm">{t("subjects.help")}</p>
    </div>
  );
}
