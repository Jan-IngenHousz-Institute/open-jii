"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { WorkbookList } from "~/components/workbook-list";
import { useWorkbooks } from "~/hooks/workbook/useWorkbooks/useWorkbooks";

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
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function ListWorkbooks() {
  const { data: workbooks, isLoading, filter, setFilter, search, setSearch } = useWorkbooks({});
  const { t } = useTranslation("workbook");
  const router = useRouter();
  const locale = useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const { mutate: createWorkbook, isPending: isCreating } = useWorkbookCreate({
    onSuccess: (data) => {
      router.push(`/${locale}/platform/workbooks/${data.body.id}`);
    },
  });

  const handleCreate = () => {
    if (isCreating) return;
    const name = newName.trim();
    if (!name) return;
    createWorkbook({ body: { name } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="relative w-full md:w-[220px]">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("workbooks.searchPlaceholder")}
            className="w-full pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t("workbooks.clearSearch")}
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder={t("workbooks.filterWorkbooks")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accessible">{t("workbooks.filterAccessible")}</SelectItem>
              <SelectItem value="public">{t("workbooks.filterPublic")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>{t("workbooks.create")}</Button>
        </div>
      </div>

      <WorkbookList workbooks={workbooks} isLoading={isLoading} />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workbooks.create")}</DialogTitle>
            <DialogDescription>{t("workbooks.createDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("workbooks.namePlaceholder")}
            maxLength={255}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
              {t("workbooks.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
              {t("workbooks.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
