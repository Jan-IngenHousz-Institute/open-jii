"use client";

import { Upload, Plus } from "lucide-react";
import { User } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@repo/ui/components";

export function ProfilePictureCard() {
  const { t } = useTranslation("account");
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-gray-400" aria-hidden />
          <CardTitle className="text-gray-500">{t("settings.profilePictureCard.title")}</CardTitle>
          <span className="inline-flex cursor-not-allowed select-none items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 opacity-70">
            {t("settings.disabled")}
          </span>
        </div>
        <CardDescription className="text-gray-500"> </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
        {/* circular placeholder */}
        <div className="bg-muted relative flex h-40 w-40 items-center justify-center rounded-full">
          <Plus className="h-6 w-6 opacity-40" aria-hidden />
        </div>

        {/* disabled upload button */}
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-gray-500"
          disabled
          aria-disabled="true"
        >
          <Upload className="h-4 w-4 text-gray-400" />
          {t("settings.profilePictureCard.upload")}
        </Button>

        <p className="text-xs text-gray-500">{t("settings.profilePictureCard.description")}</p>
      </CardContent>
    </Card>
  );
}
