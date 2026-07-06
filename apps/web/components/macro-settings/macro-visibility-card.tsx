"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { zVisibility } from "@repo/api/schemas/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { FormLabel } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { useMacroUpdate } from "../../hooks/macro/useMacroUpdate/useMacroUpdate";

type Visibility = (typeof zVisibility.enum)[keyof typeof zVisibility.enum];

interface MacroVisibilityCardProps {
  macroId: string;
  initialVisibility: Visibility;
}

export function MacroVisibilityCard({ macroId, initialVisibility }: MacroVisibilityCardProps) {
  const { t } = useTranslation("macro");
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(macroId);
  const [currentVisibility, setCurrentVisibility] = useState<Visibility>(initialVisibility);
  const [showDialog, setShowDialog] = useState(false);

  const isPublic = currentVisibility === "public";

  const confirmPublish = async () => {
    await updateMacro({ params: { id: macroId }, body: { visibility: "public" } });
    setCurrentVisibility("public");
    setShowDialog(false);
    toast({ description: t("macros.macroUpdated") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroVisibility.cardTitle")}</CardTitle>
        <CardDescription>{t("macroVisibility.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FormLabel>{t("macroVisibility.visibility")}</FormLabel>
          <Select
            value={currentVisibility}
            disabled={isPublic}
            onValueChange={(value) => {
              if (value === "public") setShowDialog(true);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(zVisibility.enum).map((value) => (
                <SelectItem key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPublic && (
            <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-xs">
              <Info className="text-primary h-4 w-4" />
              <div className="leading-tight">{t("macroVisibility.cannotBeChanged")}</div>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("macroVisibility.changeToPublicTitle")}</DialogTitle>
            <DialogDescription>{t("macroVisibility.changeToPublicDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isUpdating}>
              {t("macroSettings.cancel")}
            </Button>
            <Button onClick={confirmPublish} disabled={isUpdating}>
              {isUpdating ? t("macroSettings.saving") : t("macroVisibility.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
