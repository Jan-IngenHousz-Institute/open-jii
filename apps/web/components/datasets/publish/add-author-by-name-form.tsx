"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { zDatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

const zAuthorName = zDatasetAuthor.pick({ givenName: true, familyName: true });
type AuthorName = z.infer<typeof zAuthorName>;

interface AddAuthorByNameFormProps {
  onAdd: (author: DatasetAuthor) => void;
  onCancel: () => void;
}

/**
 * Its own form without a form element, since it sits inside the publish flow's form. A citation
 * needs both names apart, so one name field would not do.
 */
export function AddAuthorByNameForm({ onAdd, onCancel }: AddAuthorByNameFormProps) {
  const { t } = useTranslation("datasets");
  const { register, handleSubmit, formState } = useForm<AuthorName>({
    resolver: zodResolver(zAuthorName),
    defaultValues: { givenName: "", familyName: "" },
  });

  const add = (name: AuthorName) => {
    onAdd({ ...name, userId: null, orcid: null, affiliation: null, request: null });
  };

  const handleAdd = () => {
    void handleSubmit(add)();
  };

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg border p-4" data-testid="add-author-by-name">
      <div>
        <p className="text-sm font-medium">{t("describe.byNameTitle")}</p>
        <p className="text-muted-foreground text-xs">{t("describe.byNameHelp")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="author-given-name">{t("describe.givenName")}</Label>
          <Input
            id="author-given-name"
            aria-invalid={formState.errors.givenName !== undefined}
            {...register("givenName")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="author-family-name">{t("describe.familyName")}</Label>
          <Input
            id="author-family-name"
            aria-invalid={formState.errors.familyName !== undefined}
            {...register("familyName")}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("describe.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={handleAdd}>
          {t("describe.add")}
        </Button>
      </div>
    </div>
  );
}
