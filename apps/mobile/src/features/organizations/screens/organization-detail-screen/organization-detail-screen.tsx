import { useLocalSearchParams, useNavigation } from "expo-router";
import { Building2, ExternalLink } from "lucide-react-native";
import { DateTime } from "luxon";
import React, { useLayoutEffect } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { OrganizationJoinCta } from "~/features/organizations/components/organization-join-cta";
import { OrganizationMembershipTags } from "~/features/organizations/components/organization-membership-tag";
import { OrganizationOpenOnWebButton } from "~/features/organizations/components/organization-open-on-web-button";
import { organizationRoleLabelKey } from "~/features/organizations/components/organization-role-label";
import { organizationTypeLabelKey } from "~/features/organizations/components/organization-type-label";
import { OrganizationUnavailable } from "~/features/organizations/components/organization-unavailable";
import { resolveOrganizationWebsite } from "~/features/organizations/domain/website";
import { useOrganization } from "~/features/organizations/hooks/use-organization";
import { colors } from "~/shared/constants/colors";
import type { SupportedLocale } from "~/shared/i18n";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Avatar } from "~/shared/ui/Avatar";
import { Card } from "~/shared/ui/Card";
import { Tag } from "~/shared/ui/Tag";
import { cn } from "~/shared/ui/cn";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

const LUXON_LOCALE: Record<SupportedLocale, string> = {
  "en-US": "en-GB",
  "nl-NL": "nl-NL",
};

const ROW_CLASS = "border-divider mt-3 flex-row items-center justify-between border-t pt-2.5";

export function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const { t, i18n } = useTranslation(["common", "organizations"]);
  const { organization, isLoading, error, isNotFound } = useOrganization(id);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: organization?.name ?? t("organizations:detail.title"),
      headerRight:
        organization && !isNotFound
          ? () => (
              <OrganizationOpenOnWebButton
                organizationId={organization.id}
                color={themeColors.onSurface}
                size={20}
              />
            )
          : undefined,
    });
  }, [navigation, organization, isNotFound, themeColors.onSurface, t]);

  // A 404 outranks cached data; any other failure keeps it, so the profile
  // stays readable offline.
  if (isNotFound || (!organization && error)) {
    return <OrganizationUnavailable />;
  }

  if (isLoading || !organization) {
    return (
      <View className="flex-1 items-center py-16">
        <ActivityIndicator size="large" color={themeColors.brand} />
      </View>
    );
  }

  const isMember = organization.membershipStatus === "member";
  const typeKey = organizationTypeLabelKey(organization.type);
  const subtitle = [typeKey ? t(typeKey) : null, organization.location].filter(Boolean).join(" · ");

  const luxonLocale = LUXON_LOCALE[i18n.language as SupportedLocale] ?? "en-GB";
  const createdAt = DateTime.fromISO(organization.createdAt).setLocale(luxonLocale);
  const since = createdAt.isValid ? createdAt.toFormat("LLLL yyyy") : null;

  // Authored in web's rich-text editor, so it arrives as HTML.
  const description = organization.description
    ? extractTextFromHTML(organization.description).trim()
    : "";

  const website = resolveOrganizationWebsite(organization.website);
  const openWebsite = async () => {
    if (!website?.href) return;
    const canOpen = await Linking.canOpenURL(website.href);
    if (canOpen) {
      await Linking.openURL(website.href);
    } else {
      showAlert(t("common:errorTitle"), t("organizations:detail.websiteUnavailable"));
    }
  };

  const websiteRow = website ? (
    <>
      <Text className="text-muted-body text-[13px]">{t("organizations:detail.website")}</Text>
      <View className="ml-3 min-w-0 flex-row items-center gap-1.5">
        <Text
          className={cn("shrink text-[13px]", website.href ? "text-primary" : "text-on-surface")}
          numberOfLines={1}
        >
          {website.label}
        </Text>
        {website.href ? <ExternalLink size={14} color={themeColors.brand} /> : null}
      </View>
    </>
  ) : null;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card padded>
        <View className="flex-row items-center gap-3">
          <Avatar
            uri={organization.logo ?? undefined}
            size={56}
            icon={<Building2 size={24} color={colors.jii.darkGreen} />}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-on-surface min-w-0 shrink"
                style={{ fontFamily: "Poppins-Bold", fontSize: 17, lineHeight: 22 }}
                numberOfLines={2}
              >
                {organization.name}
              </Text>
              <View className="shrink-0 flex-row items-center gap-1.5">
                <OrganizationMembershipTags
                  visibility={organization.visibility}
                  membershipStatus={organization.membershipStatus}
                  showMemberTag={false}
                />
                {isMember ? (
                  <Tag variant="sensor">{t(organizationRoleLabelKey(organization.role))}</Tag>
                ) : null}
              </View>
            </View>
            {subtitle ? (
              <Text className="text-muted-body mt-0.5 text-[12.5px]">{subtitle}</Text>
            ) : null}
          </View>
        </View>

        <View className="mt-3 flex-row gap-2.5">
          <View className="bg-surface flex-1 rounded-xl p-2.5">
            <Text
              className="text-on-surface"
              style={{ fontFamily: "Poppins-Bold", fontSize: 16, lineHeight: 20 }}
            >
              {organization.memberCount}
            </Text>
            <Text className="text-muted-body text-[11px]">
              {t("organizations:detail.members", { count: organization.memberCount })}
            </Text>
          </View>
          <View className="bg-surface flex-1 rounded-xl p-2.5">
            <Text
              className="text-on-surface"
              style={{ fontFamily: "Poppins-Bold", fontSize: 16, lineHeight: 20 }}
            >
              {organization.resourceCount}
            </Text>
            {/* resourceCount is access-scoped: a non-member sees the public part. */}
            <Text className="text-muted-body text-[11px]">
              {isMember
                ? t("organizations:detail.resources", { count: organization.resourceCount })
                : t("organizations:detail.resourcesVisible", { count: organization.resourceCount })}
            </Text>
          </View>
        </View>

        <Text className="text-on-surface mt-3 text-[13px] leading-5">
          {description.length > 0 ? description : t("organizations:detail.noDescription")}
        </Text>

        {website?.href ? (
          <Pressable onPress={() => void openWebsite()} className={ROW_CLASS}>
            {websiteRow}
          </Pressable>
        ) : websiteRow ? (
          <View className={ROW_CLASS}>{websiteRow}</View>
        ) : null}

        {since ? (
          <View className={ROW_CLASS}>
            <Text className="text-muted-body text-[13px]">{t("organizations:detail.since")}</Text>
            <Text className="text-on-surface text-[13px]">{since}</Text>
          </View>
        ) : null}

        <OrganizationJoinCta
          id={organization.id}
          name={organization.name}
          membershipStatus={organization.membershipStatus}
          visibility={organization.visibility}
        />
      </Card>
    </ScrollView>
  );
}

export default OrganizationDetailScreen;
