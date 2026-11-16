"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { zDatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

const zInvitation = zDatasetAuthor
  .pick({ givenName: true, familyName: true })
  .extend({ email: z.string().email() });
type Invitation = z.infer<typeof zInvitation>;

interface AddPersonByEmailFormProps {
  onInvite: (author: DatasetAuthor) => void;
  onCancel: () => void;
}

/**
 * Its own form without a form element, since it sits inside the publish flow's form. A citation
 * needs both names apart, and the person confirms them when they accept.
 */
export function AddPersonByEmailForm({ onInvite, onCancel }: AddPersonByEmailFormProps) {
  const { t } = useTranslation("datasets");
  const { register, handleSubmit, formState } = useForm<Invitation>({
    resolver: zodResolver(zInvitation),
    defaultValues: { givenName: "", familyName: "", email: "" },
  });

  const invite = (invitation: Invitation) => {
    onInvite({
      ...invitation,
      userId: null,
      orcid: null,
      affiliation: null,
      origin: "email",
      request: "pending",
    });
  };

  const handleInvite = () => {
    void handleSubmit(invite)();
  };

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg border p-4" data-testid="add-person-by-email">
      <div>
        <p className="text-sm font-medium">{t("describe.byEmailTitle")}</p>
        <p className="text-muted-foreground text-xs">{t("describe.byEmailHelp")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="person-given-name">{t("describe.givenName")}</Label>
          <Input
            id="person-given-name"
            aria-invalid={formState.errors.givenName !== undefined}
            {...register("givenName")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="person-family-name">{t("describe.familyName")}</Label>
          <Input
            id="person-family-name"
            aria-invalid={formState.errors.familyName !== undefined}
            {...register("familyName")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="person-email">{t("describe.email")}</Label>
          <Input
            id="person-email"
            type="email"
            aria-invalid={formState.errors.email !== undefined}
            {...register("email")}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("describe.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={handleInvite}>
          {t("describe.invite")}
        </Button>
      </div>
    </div>
  );
}
