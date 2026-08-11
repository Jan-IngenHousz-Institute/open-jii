"use client";

import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useUpdateOrganization } from "@/hooks/organization/useUpdateOrganization/useUpdateOrganization";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";
import { organizationSlugRejection } from "~/util/organization-slug";

import type {
  OrganizationProfile,
  OrganizationType,
} from "@repo/api/domains/organization/organization.schema";
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
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationDangerZone } from "./organization-danger-zone";
import { ORGANIZATION_TYPES, organizationTypeLabelKey } from "./organization-labels";
import { organizationPath } from "./organization-routes";

/** Sentinel for "no type chosen": a Radix select item cannot carry an empty value. */
const NO_TYPE = "none";

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

  const saveProfile = async () => {
    if (isNameMissing || slugRejection !== null || isWebsiteInvalid) return;
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

  const setVisibility = async (isPublic: boolean) => {
    try {
      await updateOrganization({ visibility: isPublic ? "public" : "private" });
      toast({
        description: isPublic
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
    <div className="flex max-w-2xl flex-col gap-8">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void saveProfile();
        }}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("organizations.settings.profileTitle")}</h2>
          <p className="text-muted-foreground text-sm">
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
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSaving || isNameMissing || slugRejection !== null || isWebsiteInvalid}
          >
            {isSaving ? t("common.updating") : t("common.save")}
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("organizations.visibility.title")}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("organizations.visibility.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="organization-settings-visibility"
            checked={organization.visibility === "public"}
            onCheckedChange={(checked) => void setVisibility(checked)}
            disabled={isSaving}
            aria-label={t("organizations.visibility.toggleLabel")}
          />
          <Label htmlFor="organization-settings-visibility" className="text-sm font-normal">
            {organization.visibility === "public"
              ? t("organizations.visibility.publicLabel")
              : t("organizations.visibility.privateLabel")}
          </Label>
        </div>
      </section>

      <OrganizationDangerZone
        organizationId={organization.id}
        organizationName={organization.name}
      />
    </div>
  );
}

/** A cleared text field is an absent value, not an empty one. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
