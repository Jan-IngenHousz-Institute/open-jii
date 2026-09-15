import { router } from "expo-router";
import { Building2, ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
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
    <Pressable onPress={onPress} className="mb-1 mt-3" accessibilityRole="button">
      <View className="bg-card shadow-xs rounded-2xl p-3.5 shadow-black/10">
        <View className="flex-row items-center">
          <View className="bg-jii-mint h-13 w-13 mr-3 items-center justify-center rounded-[14px]">
            <Building2 size={26} color={themeColors.brand} />
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="text-on-surface text-[15px]"
              style={{ fontFamily: "Poppins-Bold" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <ChevronRight size={20} color={themeColors.inactive} />
        </View>
      </View>
    </Pressable>
  );
}
