"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { zVisibility } from "@repo/api/schemas/protocol.schema";
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

import { useProtocolUpdate } from "../../hooks/protocol/useProtocolUpdate/useProtocolUpdate";

type Visibility = (typeof zVisibility.enum)[keyof typeof zVisibility.enum];

interface ProtocolVisibilityCardProps {
  protocolId: string;
  initialVisibility: Visibility;
}

export function ProtocolVisibilityCard({
  protocolId,
  initialVisibility,
}: ProtocolVisibilityCardProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(protocolId);
  const [currentVisibility, setCurrentVisibility] = useState<Visibility>(initialVisibility);
  const [showDialog, setShowDialog] = useState(false);

  const isPublic = currentVisibility === "public";

  const confirmPublish = async () => {
    await updateProtocol({ params: { id: protocolId }, body: { visibility: "public" } });
    setCurrentVisibility("public");
    setShowDialog(false);
    toast({ description: t("protocols.protocolUpdated") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resourceVisibility.cardTitle")}</CardTitle>
        <CardDescription>{t("resourceVisibility.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FormLabel>{t("resourceVisibility.visibility")}</FormLabel>
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
              <div className="leading-tight">{t("resourceVisibility.cannotBeChanged")}</div>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resourceVisibility.changeToPublicTitle")}</DialogTitle>
            <DialogDescription>
              {t("resourceVisibility.changeToPublicDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isUpdating}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmPublish} disabled={isUpdating}>
              {isUpdating ? t("protocolSettings.saving") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
