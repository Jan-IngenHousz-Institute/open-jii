"use client";

import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { organizationSlugRejection } from "~/util/organization-slug";

import type {
  OrganizationRole,
  OrganizationType,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";
import {
  zOrganizationRole,
  zOrganizationType,
  zOrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";
import { cva } from "@repo/ui/lib/utils";

import { organizationRoleLabelKey } from "../../organizations/organization-labels";
import type { OrganizationInviteSelection } from "../../organizations/organization-member-picker";

/** Sentinel for "no type chosen": a Radix select item cannot carry an empty value. */
export const NO_TYPE = "none";

/**
 * Somebody the organization will start with: the picker's own outcome plus the role
 * they arrive on. Unapplied — the invitation that carries it is sent only once the
 * organization exists, and they join when they accept it.
 */
export type PendingOrganizationPerson = OrganizationInviteSelection & { role: OrganizationRole };

/**
 * A collected person in one line: the role they arrive on, and — for an address the user
 * search did not resolve — that nobody holds it yet. Everybody here is invited, so the
 * marker distinguishes "no account behind this address" rather than how they arrive.
 *
 * Review's reading of a person. The People step renders the same role through the same
 * `organizationRoleLabelKey`, but as the roster's editable select rather than as text,
 * so a role mistyped there is corrected where it is read.
 */
export function pendingPersonRoleText(
  person: PendingOrganizationPerson,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const roleLabel = t(organizationRoleLabelKey(person.role));
  return person.kind === "user"
    ? roleLabel
    : t("organizations.create.people.emailRole", { role: roleLabel });
}

/** What the wizard collects. */
export interface NewOrganizationFormValues {
  name: string;
  slug: string;
  type: typeof NO_TYPE | OrganizationType;
  description: string;
  website: string;
  location: string;
  visibility: OrganizationVisibility;
  people: PendingOrganizationPerson[];
}

/**
 * The messages are read out of `t` rather than written into the schema, because these
 * are the rules the single-page form this wizard replaces already stated in the user's
 * own language, and the schema is now the only thing that renders them.
 */
type Translate = (key: string) => string;

/**
 * Name, slug and type.
 *
 * The slug is the load-bearing one, and it is checked in three layers because each
 * catches what the others do not: the format and reserved-namespace rules here (the
 * availability endpoint answers only "is it taken", so a `personal-` slug would come
 * back available), availability from the server as the field is typed, and the plugin's
 * own guards on the write, which is what actually decides.
 *
 * `isSlugTaken` is what carries the server's answer into validation. Without it the
 * step would advance on a slug the create is already known to refuse, and the refusal
 * would surface three steps later, in a toast, as untranslated English.
 */
export function identitySchema(t: Translate, isSlugTaken: (slug: string) => boolean) {
  return z.object({
    // `varchar(255)`, so an uncapped name fails at the insert instead of here.
    name: z
      .string()
      .trim()
      .min(1, t("organizations.errors.nameRequired"))
      .max(255, t("organizations.errors.nameTooLong")),
    slug: z.string().superRefine((slug, ctx) => {
      const rejection = organizationSlugRejection(slug);
      if (rejection !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t(`organizations.errors.slug.${rejection}`),
        });
        return;
      }
      if (isSlugTaken(slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("organizations.errors.slug.taken"),
        });
      }
    }),
    type: z.union([z.literal(NO_TYPE), zOrganizationType]),
  });
}

/**
 * Description, website, location and visibility — all editable from settings later.
 * Visibility is the one that is always answered, so it is not optional.
 */
export function profileSchema(t: Translate) {
  return z.object({
    description: z.string().trim(),
    // The platform's standard URL rule, the same one the transfer-request form applies —
    // an empty optional field is absent rather than invalid.
    website: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || z.string().url().safeParse(value).success,
        t("organizations.errors.website"),
      ),
    location: z.string().trim(),
    visibility: zOrganizationVisibility,
  });
}

/** Whoever the organization starts with. Nobody is a valid answer. */
export const peopleSchema = z.object({
  people: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("user"),
        userId: z.string(),
        displayName: z.string(),
        // Carried through validation, not only into it: `z.object` strips what it does
        // not name, and every person collected here is invited at this address once the
        // organization exists — whether or not they already have an account.
        email: z.string(),
        role: zOrganizationRole,
      }),
      z.object({
        kind: z.literal("email"),
        email: z.string().email(),
        role: zOrganizationRole,
      }),
    ]),
  ),
});

interface CardComponent {
  form: UseFormReturn<NewOrganizationFormValues>;
}

interface FormStepProps extends WizardStepProps<NewOrganizationFormValues> {
  cards: ComponentType<CardComponent>[];
}

export function FormStep({
  form,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  cards,
}: FormStepProps) {
  const { t } = useTranslation();

  const containerVariants = cva("", {
    variants: {
      layout: {
        stack: "space-y-6",
        grid: "grid gap-6 md:grid-cols-2",
      },
    },
    defaultVariants: {
      layout: "stack",
    },
  });

  const containerClass = containerVariants({ layout: cards.length === 2 ? "grid" : "stack" });

  return (
    <div className="space-y-6">
      <div className={containerClass}>
        {cards.map((Card, index) => (
          <Card key={index} form={form} />
        ))}
      </div>
      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={t("organizations.create.next")}
        previousLabel={t("common.back")}
      />
    </div>
  );
}
