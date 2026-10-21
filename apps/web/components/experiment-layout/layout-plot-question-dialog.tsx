"use client";

import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";

import { UnitName } from "./unit-name";

interface LayoutPlotQuestionDialogProps {
  experimentId: string;
  levelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = "__none__";

interface QuestionNode {
  id: string;
  name: string;
}

/**
 * Asked once, when a layout is saved on an experiment whose workbook asks questions: which of
 * them the measurer answers with the plot's name. The app then shows its Next plot step there.
 */
export function LayoutPlotQuestionDialog({
  experimentId,
  levelName,
  open,
  onOpenChange,
}: LayoutPlotQuestionDialogProps) {
  const { t } = useTranslation("experiments");
  const { data: flow } = useExperimentFlow(experimentId);
  const unitName = new UnitName(levelName);

  const questions: QuestionNode[] = (flow?.graph.nodes ?? [])
    .filter((node) => node.type === "question")
    .map((node) => ({ id: node.id, name: node.name }));
  const guess = questions.find((question) => question.name.trim().toLowerCase() === unitName.lower);
  const [chosen, setChosen] = useState<string | null>(null);
  const value = chosen ?? guess?.id ?? NONE;

  const close = () => {
    onOpenChange(false);
  };

  const renderQuestion = (question: QuestionNode) => (
    <div key={question.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <RadioGroupItem value={question.id} id={`plot-question-${question.id}`} />
      <Label htmlFor={`plot-question-${question.id}`} className="flex-1 font-normal">
        {question.name}
      </Label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("layout.plotQuestion.title", { unit: unitName.lower })}</DialogTitle>
          <DialogDescription>
            {t("layout.plotQuestion.description", { unit: unitName.lower })}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={value} onValueChange={setChosen} className="gap-2" data-plot-question>
          {questions.map(renderQuestion)}
          <div className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2.5">
            <RadioGroupItem value={NONE} id="plot-question-none" />
            <Label
              htmlFor="plot-question-none"
              className="text-muted-foreground flex-1 font-normal"
            >
              {t("layout.plotQuestion.none", { unit: unitName.lower })}
            </Label>
          </div>
        </RadioGroup>

        <p className="text-muted-foreground text-sm">{t("layout.plotQuestion.after")}</p>

        <DialogFooter>
          <Button type="button" onClick={close}>
            {t("layout.plotQuestion.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
