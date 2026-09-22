import { router } from "expo-router";
import { Compass } from "lucide-react-native";
import React from "react";
import { useExperimentOnboardingState } from "~/features/experiments/hooks/use-experiment-onboarding-state";
import { HomeNavCard } from "~/features/home/components/home-nav-card";
import { useOrganizationOnboardingState } from "~/features/organizations/hooks/use-organization-onboarding-state";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function HomeDiscoverCard() {
  const { t } = useTranslation("home");
  const themeColors = useThemeColors();
  const { state: experimentState } = useExperimentOnboardingState();
  const { state: organizationState, isLoading: isOrganizationLoading } =
    useOrganizationOnboardingState();

  // Never nudge on an unknown: either list still without a response means the
  // student may already be somewhere.
  if (!experimentState || !organizationState || isOrganizationLoading) return null;

  // Being in an experiment is what the nudge is for, whatever the organization
  // state says, so a student who joined by code is not nagged forever.
  if (experimentState.kind === "member") return null;

  const isPending = organizationState.kind === "pending";
  const title = isPending ? t("organizations.pendingTitle") : t("discover.joinTitle");
  const subtitle = isPending ? organizationState.organization.name : t("discover.joinSubtitle");

  const onPress = () => {
    if (organizationState.kind === "pending") {
      router.push({
        pathname: "/organizations/[id]",
        params: { id: organizationState.organization.id },
      });
    } else {
      router.push("/discover");
    }
  };

  return (
    <HomeNavCard
      icon={<Compass size={26} color={themeColors.brand} />}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
}
