"use client";

import { OPEN_WORKBOOK_CREATE_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { Eye, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { OrganizationPicker } from "~/components/organizations/organization-picker";
import { getWorkbookColumns } from "~/components/overview-table/workbook-columns";
import { ResourceList } from "~/components/resource-list/resource-list";
import { resourceListFilter } from "~/components/resource-list/resource-list-filter";
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
  const list = useWorkbooks();
  const { t } = useTranslation(["workbook", "common"]);
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

  useEffect(() => {
    const openCreate = () => setCreateOpen(true);
    window.addEventListener(OPEN_WORKBOOK_CREATE_EVENT, openCreate);
    return () => window.removeEventListener(OPEN_WORKBOOK_CREATE_EVENT, openCreate);
  }, []);

  const handleCreate = () => {
    if (isCreating) return;
    const name = newName.trim();
    if (!name) return;
    createWorkbook({ name, visibility: newVisibility, organizationId: newOrganizationId });
  };

  return (
    <>
      <ResourceList
        list={list}
        filters={[
          resourceListFilter(list, "visibility", {
            label: t("workbooks.visibility"),
            icon: Eye,
            optionLabel: (value) => t(`workbooks.${value}`),
          }),
        ]}
        searchInput={{
          placeholder: t("workbooks.searchPlaceholder"),
          clearLabel: t("workbooks.clearSearch"),
          loadingLabel: t("common.loading"),
          className: "w-full md:w-[220px]",
        }}
        columns={getWorkbookColumns(t, locale)}
        getRowKey={(workbook) => workbook.id}
        getRowHref={(workbook) => `/${locale}/platform/workbooks/${workbook.id}`}
        errorMessage={t("workbooks.errorLoading")}
        emptyMessages={{
          filtered: t("workbooks.noFilterMatches"),
          searched: t("workbooks.noMatches"),
          empty: t("workbooks.noWorkbooks"),
        }}
        emptyHelpPath="/guide/experiments/workbooks"
      />

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
              <Plus className="size-4" aria-hidden />
              {t("workbooks.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
