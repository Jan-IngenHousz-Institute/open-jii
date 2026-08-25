"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { ListPagination } from "~/components/list-pagination";
import { OrganizationPicker } from "~/components/organizations/organization-picker";
import { OverviewTable } from "~/components/overview-table/overview-table";
import { getWorkbookColumns } from "~/components/overview-table/workbook-columns";
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
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function ListWorkbooks() {
  const {
    data: workbooks,
    isLoading,
    isPlaceholderData,
    search,
    setSearch,
    page,
    setPage,
  } = useWorkbooks({});
  const { t } = useTranslation("workbook");
  const router = useRouter();
  const locale = useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private">("public");
  // Undefined is the default target: the creator's personal workspace.
  const [newOrganizationId, setNewOrganizationId] = useState<string | undefined>(undefined);
  const { mutate: createWorkbook, isPending: isCreating } = useWorkbookCreate({
    onSuccess: (data) => {
      router.push(`/${locale}/platform/workbooks/${data.id}`);
    },
  });

  const handleCreate = () => {
    if (isCreating) return;
    const name = newName.trim();
    if (!name) return;
    createWorkbook({ name, visibility: newVisibility, organizationId: newOrganizationId });
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
          <Button onClick={() => setCreateOpen(true)}>{t("workbooks.create")}</Button>
        </div>
      </div>

      <div
        aria-busy={isPlaceholderData}
        className={`space-y-4 transition-opacity${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <OverviewTable
          columns={getWorkbookColumns(t)}
          items={workbooks?.items}
          isLoading={isLoading}
          getRowKey={(workbook) => workbook.id}
          getRowHref={(workbook) => `/${locale}/platform/workbooks/${workbook.id}`}
          emptyMessage={t("workbooks.noWorkbooks")}
          emptyHelpPath={!search ? "/guide/experiments/workbooks" : undefined}
        />

        {workbooks && (
          <ListPagination page={page} totalPages={workbooks.totalPages} onPageChange={setPage} />
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName("");
            setNewVisibility("public");
            setNewOrganizationId(undefined);
          }
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
          {/* Labelled like the macro/protocol create forms: the placeholder alone
              left the control with no accessible name. */}
          <div className="space-y-2">
            <Label htmlFor="new-workbook-visibility">{t("workbooks.visibility")}</Label>
            <Select
              value={newVisibility}
              onValueChange={(value) => setNewVisibility(value as "public" | "private")}
            >
              <SelectTrigger id="new-workbook-visibility">
                <SelectValue placeholder={t("workbooks.selectVisibility")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("workbooks.public")}</SelectItem>
                <SelectItem value="private">{t("workbooks.private")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <OrganizationPicker
            id="new-workbook-organization"
            value={newOrganizationId}
            onChange={setNewOrganizationId}
            disabled={isCreating}
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
