"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTranslation } from "@repo/i18n";

export default function NewWorkbookPage() {
  const router = useRouter();
  const locale = useLocale();
  const { t } = useTranslation("workbook");
  const {
    mutate: createWorkbook,
    isPending: _isPending,
    isError,
  } = useWorkbookCreate({
    onSuccess: (data) => {
      router.replace(`/${locale}/platform/workbooks/${data.body.id}`);
    },
    onError: () => {
      router.back();
    },
  });

  const created = useRef(false);

  useEffect(() => {
    if (created.current) return;
    created.current = true;

    const now = new Date();
    const name = `Untitled Workbook - ${now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    createWorkbook({ body: { name } });
  }, [createWorkbook]);

  if (isError) {
    return null;
  }

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-muted-foreground flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t("newWorkbook.creating")}</span>
      </div>
    </div>
  );
}
