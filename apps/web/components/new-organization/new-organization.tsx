"use client";

import { useCreateOrganization } from "@/hooks/organization/useCreateOrganization/useCreateOrganization";
import { useInviteOrganizationMember } from "@/hooks/organization/useInviteOrganizationMember/useInviteOrganizationMember";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

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
import { WizardForm } from "@repo/ui/components/wizard-form";
import type { WizardStep, WizardStepProps } from "@repo/ui/components/wizard-form";
import { toast } from "@repo/ui/hooks/use-toast";

import { organizationPath } from "../organizations/organization-routes";
import { NewOrganizationIdentityCard } from "./new-organization-identity-card";
import { NewOrganizationPeopleCard } from "./new-organization-people-card";
import { NewOrganizationProfileCard } from "./new-organization-profile-card";
import { NewOrganizationVisibilityCard } from "./new-organization-visibility-card";
import type { NewOrganizationFormValues } from "./steps/form-step";
import { FormStep, NO_TYPE, identitySchema, peopleSchema, profileSchema } from "./steps/form-step";
import { ReviewStep, reviewSchema } from "./steps/review-step/review-step";

/**
 * Creating an organization: identity, profile, people, review.
 *
 * Directory visibility is chosen on the profile step and starts on private, so an
 * organization is listed only because somebody chose to list it.
 */
export function NewOrganizationForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();

  const { mutateAsync: createOrganization, isPending } = useCreateOrganization();
  const { mutateAsync: invite } = useInviteOrganizationMember();
  const [isApplyingPeople, setIsApplyingPeople] = useState(false);
  const [hasFormData, setHasFormData] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // What suppresses the unsaved-changes guard: from the moment the create is in flight
  // until the redirect, this wizard's own navigation is the happy path rather than an
  // abandonment. A failed create clears it again, because then there is still work here.
  const isSubmitting = isPending || isApplyingPeople;

  // Shared with the identity card, which fills it from the availability check.
  const takenSlugs = useRef(new Set<string>());
  const isSlugTaken = (slug: string) => takenSlugs.current.has(slug);

  /**
   * The step components, memoized for the wizard's whole life and deliberately apart from
   * the steps array below.
   *
   * A component's identity is what React mounts: hand `WizardForm` a new function for the
   * step in view and it unmounts the old one, taking every field's DOM state and the
   * card's own state with it. These are recreated by nothing — not a re-render from the
   * unsaved-changes guard, not a new `t` — while the steps array is free to rebuild its
   * labels and schemas, which are plain values.
   *
   * They capture nothing stale: the cards read live values off `form`, and `takenSlugs`
   * is a ref whose contents are read on use.
   */
  const stepComponents = useMemo(() => {
    const createFormStep = (cards: Parameters<typeof FormStep>[0]["cards"]) => {
      const Component = (props: WizardStepProps<NewOrganizationFormValues>) => (
        <FormStep {...props} cards={cards} />
      );
      return Component;
    };

    return {
      identity: createFormStep([
        (props) => <NewOrganizationIdentityCard {...props} takenSlugs={takenSlugs.current} />,
      ]),
      profile: createFormStep([NewOrganizationProfileCard, NewOrganizationVisibilityCard]),
      people: createFormStep([NewOrganizationPeopleCard]),
    };
  }, []);

  const steps: WizardStep<NewOrganizationFormValues>[] = useMemo(
    () => [
      {
        title: t("organizations.create.identityStep"),
        description: t("organizations.create.identityDescription"),
        validationSchema: identitySchema(t, isSlugTaken),
        component: stepComponents.identity,
      },
      {
        title: t("organizations.create.profileStep"),
        description: t("organizations.create.profileDescription"),
        validationSchema: profileSchema(t),
        component: stepComponents.profile,
      },
      {
        title: t("organizations.create.peopleStep"),
        description: t("organizations.create.peopleDescription"),
        validationSchema: peopleSchema,
        component: stepComponents.people,
      },
      {
        title: t("organizations.create.reviewStep"),
        description: t("organizations.create.reviewDescription"),
        validationSchema: reviewSchema(t, isSlugTaken),
        component: ReviewStep,
      },
    ],
    // `isSlugTaken` reads a ref, so it is stable without being listed.
    [t, stepComponents],
  );

  /**
   * Create the organization, then invite the people best-effort — and go to the
   * organization either way.
   *
   * `authClient.organization.create()` accepts organization fields only: Better Auth
   * owns the row, the slug uniqueness check and the creator's owner membership, and has
   * no notion of anybody else to enrol alongside them. An experiment can carry its
   * collaborators in the create body because that endpoint is ours and transactional;
   * organizations have no equivalent, so every person collected here is a separate write
   * that cannot happen until the organization exists.
   *
   * That makes the create the commit, not the form. Once it succeeds the organization
   * exists and is owned, so an invitation that fails afterwards is an invitation that
   * failed — not a creation that failed. Deleting the organization to make the submit
   * atomic would destroy the part that worked, and holding the user in the wizard would
   * strand them in front of a form whose primary action has already happened. So the
   * destination is the same either way, and whoever was not reached is named so they can
   * be invited again from the organization's Members tab.
   *
   * Nobody is on the roster when this returns, however well it goes: the wizard collects
   * people to invite, and each of them joins when they accept.
   */
  const onSubmit = async (values: NewOrganizationFormValues) => {
    let organizationId: string | undefined;

    try {
      const organization = await createOrganization({
        name: values.name,
        slug: values.slug,
        ...(values.type === NO_TYPE ? {} : { type: values.type }),
        description: values.description,
        website: values.website,
        location: values.location,
        visibility: values.visibility,
      });
      organizationId = organization?.id;
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.create.failed"),
        variant: "destructive",
      });
      return;
    }

    toast({ description: t("organizations.create.created", { name: values.name }) });
    // `create` answers with the new row, so the destination is known without a re-read;
    // a missing id would mean nothing to navigate to and nothing to add anybody to.
    if (!organizationId) return;

    setIsApplyingPeople(true);

    // Sequential rather than concurrent: a handful of writes at most, and the report of
    // what failed reads in the order the people were added.
    const failed: string[] = [];
    for (const person of values.people) {
      try {
        // Always an invitation, account or not: nobody joins an organization they did
        // not ask to join, and nobody in this wizard has been asked yet. Both collected
        // shapes carry the address to send it to.
        await invite({ organizationId, email: person.email, role: person.role });
      } catch {
        // The refusal itself is not surfaced: the two paths fail through different
        // clients with different messages, and what a retry needs is who to retry.
        failed.push(person.kind === "user" ? person.displayName : person.email);
      }
    }

    if (failed.length > 0) {
      toast({
        description: t("organizations.create.people.failed", { names: failed.join(", ") }),
        variant: "destructive",
      });
    }

    router.push(organizationPath(locale, organizationId));
  };

  const handleFormChange = () => {
    if (!hasFormData) {
      setHasFormData(true);
    }
  };

  // Block navigation when there are unsaved changes — the protocol wizard's guard,
  // copied rather than shared: the experiment wizard's copy has drifted from it (it
  // leaves by assigning `window.location.href`, a full reload, where this one pushes the
  // route), and forcing one abstraction over two behaviours would change one of them.
  useEffect(() => {
    if (!hasFormData || isSubmitting) return;

    // Intercept internal Next.js link clicks
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link?.href && !link.target && link.origin === window.location.origin) {
        e.preventDefault();
        e.stopPropagation();
        const pathname = link.pathname + link.search + link.hash;
        setPendingNavigation(() => () => {
          router.push(pathname);
        });
        setShowDialog(true);
      }
    };

    // Warn only on tab close or page refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showDialog) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasFormData, isSubmitting, showDialog, router]);

  const handleCancelNavigation = () => {
    setShowDialog(false);
    setPendingNavigation(null);
  };

  const handleConfirmNavigation = () => {
    setShowDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
    }
  };

  return (
    <>
      {/* Typing anywhere in the wizard is what marks it dirty, the same signal the other
          two use. Every person collected on the People step is reached by typing into the
          picker's search first, so a wizard holding people is always a dirty one. */}
      <div onChange={handleFormChange} onInput={handleFormChange}>
        <WizardForm<NewOrganizationFormValues>
          steps={steps}
          defaultValues={{
            name: "",
            slug: "",
            type: NO_TYPE,
            description: "",
            website: "",
            location: "",
            visibility: "private",
            people: [],
          }}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          showStepIndicator={true}
          showStepTitles={true}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={handleCancelNavigation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("organizations.create.unsavedChangesTitle")}</DialogTitle>
            <DialogDescription>{t("organizations.create.unsavedChangesMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNavigation}>
              {t("organizations.create.unsavedStay")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              {t("organizations.create.unsavedLeave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
