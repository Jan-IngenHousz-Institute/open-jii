"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useUpdateOrganization } from "@/hooks/organization/useUpdateOrganization/useUpdateOrganization";
import { useLocale } from "@/hooks/useLocale";
import { Globe, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";
import { organizationSlugRejection } from "~/util/organization-slug";

import type {
  OrganizationProfile,
  OrganizationType,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
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
import { cn } from "@repo/ui/lib/utils";

import { OrganizationDangerZone } from "./organization-danger-zone";
import { ORGANIZATION_TYPES, organizationTypeLabelKey } from "./organization-labels";
import { organizationPath } from "./organization-routes";

/** Sentinel for "no type chosen": a Radix select item cannot carry an empty value. */
const NO_TYPE = "none";

/** So the unsaved-changes bar can submit the profile form from outside it. */
const PROFILE_FORM_ID = "organization-profile-form";

/**
 * Organization settings, owner-only. Better Auth's own admin role carries
 * `organization:update` by default; openJII strips it, so an admin cannot rename
 * the organization or list it in the directory — and this surface is absent for
 * them rather than present and refused.
 */
export function OrganizationSettingsSurface({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const locale = useLocale();

  const { data: organization, isPending } = useOrganization(organizationId);
  const isOwner = organization?.role === "owner";

  // Someone who is not an owner never saw the tab but may have the URL.
  useEffect(() => {
    if (organization && !isOwner) router.replace(organizationPath(locale, organizationId));
  }, [organization, isOwner, router, locale, organizationId]);

  if (isPending || !organization || !isOwner) return null;

  return <OwnerSettingsForm organization={organization} />;
}

function OwnerSettingsForm({ organization }: { organization: OrganizationProfile }) {
  const { t } = useTranslation();

  const { mutateAsync: updateOrganization, isPending: isSaving } = useUpdateOrganization(
    organization.id,
  );

  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug ?? "");
  const [type, setType] = useState<string>(organization.type ?? NO_TYPE);
  const [description, setDescription] = useState(organization.description ?? "");
  const [website, setWebsite] = useState(organization.website ?? "");
  const [location, setLocation] = useState(organization.location ?? "");

  const trimmedName = name.trim();
  const slugRejection = organizationSlugRejection(slug);
  const isNameMissing = trimmedName.length === 0;
  // The platform's standard URL rule, the same one the transfer-request form applies —
  // an empty optional field is absent rather than invalid.
  const isWebsiteInvalid =
    website.trim().length > 0 && !z.string().url().safeParse(website.trim()).success;

  // Visibility is not part of this form: it saves on click, so it is never unsaved.
  const isDirty =
    name !== organization.name ||
    slug !== (organization.slug ?? "") ||
    type !== (organization.type ?? NO_TYPE) ||
    description !== (organization.description ?? "") ||
    website !== (organization.website ?? "") ||
    location !== (organization.location ?? "");
  const isInvalid = isNameMissing || slugRejection !== null || isWebsiteInvalid;

  const discard = () => {
    setName(organization.name);
    setSlug(organization.slug ?? "");
    setType(organization.type ?? NO_TYPE);
    setDescription(organization.description ?? "");
    setWebsite(organization.website ?? "");
    setLocation(organization.location ?? "");
  };

  const saveProfile = async () => {
    if (isInvalid) return;
    try {
      await updateOrganization({
        name: trimmedName,
        slug,
        // Cleared optional fields are sent as null, which is what makes them
        // absent again rather than set to an empty string.
        type: type === NO_TYPE ? null : (type as OrganizationType),
        description: emptyToNull(description),
        website: emptyToNull(website),
        location: emptyToNull(location),
      });
      toast({ description: t("organizations.settings.saved") });
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.settings.saveFailed"),
        variant: "destructive",
      });
    }
  };

  const setVisibility = async (visibility: OrganizationVisibility) => {
    if (visibility === organization.visibility) return;
    try {
      await updateOrganization({ visibility });
      toast({
        description:
          visibility === "public"
            ? t("organizations.visibility.nowPublic")
            : t("organizations.visibility.nowPrivate"),
      });
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.visibility.changeFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("organizations.settings.title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("organizations.settings.description")}</p>
        <DocsHelpLink path="/guide/organizations/deleting" className="mt-1" />
      </div>

      <Card className="p-5">
        <form
          id={PROFILE_FORM_ID}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold">{t("organizations.settings.profileTitle")}</h3>
            <p className="text-muted-foreground text-xs">
              {t("organizations.settings.profileDescription")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organization-settings-name">{t("organizations.fields.name")}</Label>
            <Input
              id="organization-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              aria-invalid={isNameMissing}
            />
            {isNameMissing ? (
              <p className="text-destructive text-xs">{t("organizations.errors.nameRequired")}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organization-settings-slug">{t("organizations.fields.slug")}</Label>
            <Input
              id="organization-settings-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isSaving}
              aria-invalid={slugRejection !== null}
            />
            {slugRejection !== null ? (
              <p className="text-destructive text-xs">
                {t(`organizations.errors.slug.${slugRejection}`)}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">{t("organizations.slug.renameHint")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organization-settings-type">{t("organizations.fields.type")}</Label>
            <Select value={type} onValueChange={setType} disabled={isSaving}>
              <SelectTrigger id="organization-settings-type">
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
            <Label htmlFor="organization-settings-description">
              {t("organizations.fields.description")}
            </Label>
            <Textarea
              id="organization-settings-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="min-h-24"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="organization-settings-website">
                {t("organizations.fields.website")}
              </Label>
              <Input
                id="organization-settings-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isSaving}
                aria-invalid={isWebsiteInvalid}
              />
              {isWebsiteInvalid ? (
                <p className="text-destructive text-xs">{t("organizations.errors.website")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization-settings-location">
                {t("organizations.fields.location")}
              </Label>
              <Input
                id="organization-settings-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{t("organizations.visibility.title")}</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("organizations.visibility.description")}
          </p>
        </div>

        {/* Two cards rather than a switch: the two states are not a feature being
            turned on and off, they are a choice whose consequences differ enough that
            each needs a sentence. */}
        <div
          role="radiogroup"
          aria-label={t("organizations.visibility.title")}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <VisibilityCard
            icon={Lock}
            title={t("organizations.visibility.privateLabel")}
            description={t("organizations.visibility.privateHint")}
            isSelected={organization.visibility === "private"}
            disabled={isSaving}
            onSelect={() => void setVisibility("private")}
          />
          <VisibilityCard
            icon={Globe}
            title={t("organizations.visibility.publicLabel")}
            description={t("organizations.visibility.publicHint")}
            isSelected={organization.visibility === "public"}
            disabled={isSaving}
            onSelect={() => void setVisibility("public")}
          />
        </div>
      </Card>

      <OrganizationDangerZone
        organizationId={organization.id}
        organizationName={organization.name}
      />

      {/* The bar is the profile form's only save control, submitting it by id from
          outside it — so there is one Save on the page rather than two identical ones,
          and Enter in a field still submits because a submit button exists whenever
          there is anything to submit. */}
      {isDirty ? (
        <div className="bg-foreground text-background sticky bottom-4 flex items-center gap-3 rounded-lg p-3 shadow-lg">
          <span className="flex-1 text-sm">{t("organizations.settings.unsaved")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={discard}
            disabled={isSaving}
            className="text-background hover:bg-background/15 hover:text-background"
          >
            {t("common.discard")}
          </Button>
          <Button
            type="submit"
            form={PROFILE_FORM_ID}
            size="sm"
            variant="secondary"
            disabled={isSaving || isInvalid}
          >
            {isSaving ? t("common.updating") : t("common.save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function VisibilityCard({
  icon: Icon,
  title,
  description,
  isSelected,
  disabled,
  onSelect,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-md border p-3.5 text-left transition-colors disabled:opacity-60",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/60",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-sm font-semibold">{title}</span>
        <span
          aria-hidden
          className={cn(
            "ml-auto grid h-4 w-4 shrink-0 place-items-center rounded-full border",
            isSelected ? "border-primary" : "border-input",
          )}
        >
          {isSelected ? <span className="bg-primary h-2 w-2 rounded-full" /> : null}
        </span>
      </span>
      <span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed">
        {description}
      </span>
    </button>
  );
}

/** A cleared text field is an absent value, not an empty one. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
