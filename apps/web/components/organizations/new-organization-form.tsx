"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useCreateOrganization } from "@/hooks/organization/useCreateOrganization/useCreateOrganization";
import { useOrganizationSlugAvailability } from "@/hooks/organization/useOrganizationSlugAvailability/useOrganizationSlugAvailability";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";
import { organizationSlugRejection, suggestOrganizationSlug } from "~/util/organization-slug";

import type { OrganizationType } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

import { ORGANIZATION_TYPES, organizationTypeLabelKey } from "./organization-labels";
import { organizationPath } from "./organization-routes";

/** Sentinel for "no type chosen": a Radix select item cannot carry an empty value. */
const NO_TYPE = "none";

/**
 * Creating an organization. New organizations are always private — the server
 * forces it on create, so the directory is something you opt into afterwards from
 * settings rather than a decision buried in this form.
 *
 * The slug is validated in three layers, and all three are needed: format and the
 * reserved `personal-` namespace here (the availability endpoint bypasses the
 * guard that owns those rules, so a reserved slug would come back "available"),
 * availability from the server as you type, and the real guards on the write
 * itself, which is what actually decides.
 */
export function NewOrganizationForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [type, setType] = useState<string>(NO_TYPE);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const { mutateAsync: createOrganization, isPending } = useCreateOrganization();

  const trimmedName = name.trim();
  const slugRejection = organizationSlugRejection(slug);
  const [debouncedSlug, isSlugDebounced] = useDebounce(slug);

  // Only ask the server about a slug it could actually accept.
  const canCheckAvailability = slugRejection === null && debouncedSlug === slug;
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useOrganizationSlugAvailability(
    debouncedSlug,
    { enabled: canCheckAvailability },
  );

  const isNameMissing = trimmedName.length === 0;
  // The platform's standard URL rule, the same one the transfer-request form applies —
  // an empty optional field is absent rather than invalid.
  const isWebsiteInvalid =
    website.trim().length > 0 && !z.string().url().safeParse(website.trim()).success;
  // Errors appear once a field has content or once submission was attempted, so
  // an untouched form is not pre-scolded.
  const showSlugError = slugRejection !== null && (slug.length > 0 || hasSubmitted);
  const isSlugTaken = canCheckAvailability && isSlugAvailable === false;
  const isSlugSettled = canCheckAvailability && isSlugDebounced && !isCheckingSlug;

  const handleNameChange = (next: string) => {
    setName(next);
    // The slug follows the name until it is edited by hand, then it is the user's.
    if (!isSlugEdited) setSlug(suggestOrganizationSlug(next));
  };

  const submit = async () => {
    setHasSubmitted(true);
    if (isNameMissing || slugRejection !== null || isSlugTaken || isWebsiteInvalid) return;

    try {
      const organization = await createOrganization({
        name: trimmedName,
        slug,
        ...(type === NO_TYPE ? {} : { type: type as OrganizationType }),
        description: description.trim(),
        website: website.trim(),
        location: location.trim(),
      });
      toast({ description: t("organizations.create.created", { name: trimmedName }) });
      // `create` answers with the new row, so the destination is known without a
      // re-read; a missing id would mean nothing to navigate to.
      if (organization?.id) router.push(organizationPath(locale, organization.id));
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.create.failed"),
        variant: "destructive",
      });
    }
  };

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DocsHelpLink path="/guide/organizations" />

      <div className="space-y-1.5">
        <Label htmlFor="organization-name">{t("organizations.fields.name")}</Label>
        <Input
          id="organization-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={isPending}
          aria-invalid={hasSubmitted && isNameMissing}
        />
        {hasSubmitted && isNameMissing ? (
          <p className="text-destructive text-xs">{t("organizations.errors.nameRequired")}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organization-slug">{t("organizations.fields.slug")}</Label>
        <div className="relative">
          <Input
            id="organization-slug"
            value={slug}
            onChange={(e) => {
              setIsSlugEdited(true);
              setSlug(e.target.value);
            }}
            disabled={isPending}
            aria-invalid={showSlugError || isSlugTaken}
            aria-describedby="organization-slug-hint"
          />
          {isSlugSettled && isSlugAvailable === true ? (
            <Check
              aria-label={t("organizations.slug.available")}
              className="text-primary absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
          ) : canCheckAvailability && isCheckingSlug ? (
            <Loader2
              aria-label={t("organizations.slug.checking")}
              className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            />
          ) : null}
        </div>
        {showSlugError ? (
          <p className="text-destructive text-xs">
            {t(`organizations.errors.slug.${slugRejection}`)}
          </p>
        ) : isSlugTaken ? (
          <p className="text-destructive text-xs">{t("organizations.errors.slug.taken")}</p>
        ) : (
          <p id="organization-slug-hint" className="text-muted-foreground text-xs">
            {t("organizations.slug.hint")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organization-type">{t("organizations.fields.type")}</Label>
        <Select value={type} onValueChange={setType} disabled={isPending}>
          <SelectTrigger id="organization-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TYPE}>{t("organizations.types.unspecified")}</SelectItem>
            {ORGANIZATION_TYPES.map((organizationType) => (
              <SelectItem key={organizationType} value={organizationType}>
                {t(organizationTypeLabelKey(organizationType))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organization-description">{t("organizations.fields.description")}</Label>
        <Textarea
          id="organization-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="organization-website">{t("organizations.fields.website")}</Label>
          <Input
            id="organization-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={isPending}
            aria-invalid={isWebsiteInvalid}
          />
          {isWebsiteInvalid ? (
            <p className="text-destructive text-xs">{t("organizations.errors.website")}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="organization-location">{t("organizations.fields.location")}</Label>
          <Input
            id="organization-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("organizations.create.privacyNote")}
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending || isSlugTaken || isWebsiteInvalid}>
          {isPending ? t("organizations.create.creating") : t("organizations.createAction")}
        </Button>
      </div>
    </form>
  );
}
