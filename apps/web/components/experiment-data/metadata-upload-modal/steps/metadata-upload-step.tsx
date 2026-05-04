"use client";

import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentMetadata } from "@/hooks/experiment/useExperimentMetadata/useExperimentMetadata";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

import {
  makeCustomMetadataFormSchema,
  sanitizeQuestionLabel,
} from "@repo/api/schemas/experiment.schema";

import { asStoredMetadata, EMPTY_FORM_VALUES } from "../form-helpers";
import type { MetadataFormValues } from "../form-helpers";
import { MetadataEditView } from "../metadata-edit-view";
import type { QuestionOption } from "../metadata-edit-view";
import { MetadataListView } from "../metadata-list-view";

interface MetadataUploadStepProps {
  experimentId: string;
  onClose: () => void;
}

export function MetadataUploadStep({ experimentId, onClose }: MetadataUploadStepProps) {
  const { data: existingMetadataResponse } = useExperimentMetadata(experimentId);
  const existingRecords = useMemo(
    () => existingMetadataResponse?.body ?? [],
    [existingMetadataResponse?.body],
  );

  const { data: flowData } = useExperimentFlow(experimentId);
  const questionOptions = useMemo<QuestionOption[]>(() => {
    const nodes = flowData?.body.graph.nodes;
    if (!nodes) return [];
    return nodes
      .filter((node: { type: string }) => node.type === "question")
      .map((node: { name: string }) => ({
        id: sanitizeQuestionLabel(node.name),
        name: node.name,
      }));
  }, [flowData]);

  const reservedQuestionLabels = useMemo(
    () => new Set(questionOptions.map((q) => q.id)),
    [questionOptions],
  );

  // Schema is rebuilt when the flow's question set changes so the resolver
  // always has the current collision set.
  const formSchema = useMemo(
    () => makeCustomMetadataFormSchema(reservedQuestionLabels),
    [reservedQuestionLabels],
  );

  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);

  const form = useForm<MetadataFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const startNewUpload = useCallback(() => {
    form.reset(EMPTY_FORM_VALUES);
    setEditingMetadataId(null);
    setMode("edit");
  }, [form]);

  const startEditing = useCallback(
    (metadataId: string) => {
      const record = existingRecords.find((r) => r.metadataId === metadataId);
      if (!record) return;
      const meta = asStoredMetadata(record);
      form.reset({
        name: meta.name ?? "",
        columns: meta.columns ?? [],
        rows: meta.rows ?? [],
        identifierColumnId: meta.identifierColumnId ?? "",
        experimentQuestionId: meta.experimentQuestionId ?? "",
      });
      setEditingMetadataId(metadataId);
      setMode("edit");
    },
    [existingRecords, form],
  );

  const backToList = useCallback(() => {
    form.reset(EMPTY_FORM_VALUES);
    setEditingMetadataId(null);
    setMode("list");
  }, [form]);

  if (mode === "list") {
    return (
      <MetadataListView
        experimentId={experimentId}
        records={existingRecords}
        onEdit={startEditing}
        onAddNew={startNewUpload}
        onClose={onClose}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <MetadataEditView
        experimentId={experimentId}
        existingRecords={existingRecords}
        editingMetadataId={editingMetadataId}
        questionOptions={questionOptions}
        onBack={existingRecords.length > 0 ? backToList : onClose}
      />
    </FormProvider>
  );
}
