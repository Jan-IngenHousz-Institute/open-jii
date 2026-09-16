import { router } from "expo-router";
import { Building2 } from "lucide-react-native";
import React from "react";
import { HomeNavCard } from "~/features/home/components/home-nav-card";
import { useOrganizationOnboardingState } from "~/features/organizations/hooks/use-organization-onboarding-state";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export function HomeOrganizationsCard() {
  const { t } = useTranslation("home");
  const themeColors = useThemeColors();
  const { state, isLoading } = useOrganizationOnboardingState();

  if (isLoading || !state || state.kind === "member") return null;

  const isPending = state.kind === "pending";
  const title = isPending ? t("organizations.pendingTitle") : t("organizations.joinTitle");
  const subtitle = isPending ? state.organization.name : t("organizations.joinSubtitle");

  const onPress = () => {
    if (state.kind === "pending") {
      router.push({ pathname: "/organizations/[id]", params: { id: state.organization.id } });
    } else {
      router.push("/organizations");
    }
  };

  return (
    <HomeNavCard
      icon={<Building2 size={26} color={themeColors.brand} />}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
    />
  );
}
