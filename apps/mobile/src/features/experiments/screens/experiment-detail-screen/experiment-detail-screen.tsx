import { useLocalSearchParams, useNavigation } from "expo-router";
import { Archive, FlaskConical } from "lucide-react-native";
import { DateTime } from "luxon";
import React, { useLayoutEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ExperimentJoinCta } from "~/features/experiments/components/experiment-join-cta";
import { ExperimentMembershipTag } from "~/features/experiments/components/experiment-membership-tag";
import { ExperimentOpenOnWebButton } from "~/features/experiments/components/experiment-open-on-web-button";
import { ExperimentUnavailable } from "~/features/experiments/components/experiment-unavailable";
import { useExperimentAccess } from "~/features/experiments/hooks/use-experiment-access";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { luxonLocale } from "~/shared/i18n/luxon-locale";
import { Avatar } from "~/shared/ui/Avatar";
import { Banner } from "~/shared/ui/Banner";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { Tag } from "~/shared/ui/Tag";
import { experimentStatusLabelKey } from "~/shared/ui/experiment-status-label";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

const DESCRIPTION_PREVIEW_LENGTH = 220;

const ROW_CLASS = "border-divider mt-3 flex-row items-center justify-between border-t pt-2.5";

export function ExperimentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const { t, i18n } = useTranslation(["common", "experiments"]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const { experiment, membershipStatus, isLoading, isPaused, error, isUnavailable, refetch } =
    useExperimentAccess(id);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: experiment?.name ?? t("experiments:detail.title"),
      headerRight:
        experiment && !isUnavailable
          ? () => (
              <ExperimentOpenOnWebButton
                experimentId={experiment.id}
                color={themeColors.onSurface}
                size={20}
              />
            )
          : undefined,
    });
  }, [navigation, experiment, isUnavailable, themeColors.onSurface, t]);

  // A definitive refusal is a dead end. It outranks cached data; every other
  // failure keeps it, so the experiment stays readable offline.
  if (isUnavailable) {
    return <ExperimentUnavailable />;
  }

  // Nothing cached and the read did not land: errored, or paused before the
  // network, which carries no error and would otherwise spin forever.
  if (!experiment && (error || isPaused)) {
    return (
      <View className="flex-1 items-center gap-3 px-6 py-16">
        <Text className="text-error text-center">
          {t(isPaused && !error ? "experiments:detail.offline" : "experiments:detail.loadFailed")}
        </Text>
        <Button title={t("common:retry")} onPress={() => void refetch()} variant="light" />
      </View>
    );
  }

  if (isLoading || !experiment || !membershipStatus) {
    return (
      <View className="flex-1 items-center py-16">
        <ActivityIndicator size="large" color={themeColors.brand} />
      </View>
    );
  }

  const isArchived = experiment.status === "archived";
  const statusKey = experimentStatusLabelKey(experiment.status);

  const owner = [experiment.ownerFirstName, experiment.ownerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const subtitle = [
    experiment.organizationName,
    owner.length > 0 ? t("experiments:detail.by", { name: owner }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const createdAt = DateTime.fromISO(experiment.createdAt).setLocale(luxonLocale(i18n.language));
  const since = createdAt.isValid ? createdAt.toFormat("LLLL yyyy") : null;

  // Both are absent from the access read today: `checkAccess` selects an
  // explicit field list that carries neither. Each tile is gated on its own
  // value so the row simply does not render rather than showing a blank stat.
  const locationCount = experiment.locations?.length;
  const hasCollaborators = typeof experiment.membersCount === "number";
  const hasLocations = typeof locationCount === "number" && locationCount > 0;

  // Authored in web's rich-text editor, so it arrives as HTML.
  const description = experiment.description
    ? extractTextFromHTML(experiment.description).trim()
    : "";
  const isDescriptionTruncated = description.length > DESCRIPTION_PREVIEW_LENGTH;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card padded>
        <View className="flex-row items-center gap-3">
          <Avatar size={56} icon={<FlaskConical size={24} color={colors.jii.darkGreen} />} />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-on-surface min-w-0 shrink"
                style={{ fontFamily: "Poppins-Bold", fontSize: 17, lineHeight: 22 }}
                numberOfLines={2}
              >
                {experiment.name}
              </Text>
              <View className="shrink-0 flex-row items-center gap-1.5">
                <ExperimentMembershipTag membershipStatus={membershipStatus} />
                {statusKey ? <Tag>{t(statusKey)}</Tag> : null}
              </View>
            </View>
            {subtitle ? (
              <Text className="text-muted-body mt-0.5 text-[12.5px]">{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {hasCollaborators || hasLocations ? (
          <View className="mt-3 flex-row gap-2.5">
            {hasCollaborators ? (
              <View className="bg-surface flex-1 rounded-xl p-2.5">
                <Text
                  className="text-on-surface"
                  style={{ fontFamily: "Poppins-Bold", fontSize: 16, lineHeight: 20 }}
                >
                  {experiment.membersCount}
                </Text>
                <Text className="text-muted-body text-[11px]">
                  {t("experiments:detail.collaborators", { count: experiment.membersCount })}
                </Text>
              </View>
            ) : null}
            {hasLocations ? (
              <View className="bg-surface flex-1 rounded-xl p-2.5">
                <Text
                  className="text-on-surface"
                  style={{ fontFamily: "Poppins-Bold", fontSize: 16, lineHeight: 20 }}
                >
                  {locationCount}
                </Text>
                <Text className="text-muted-body text-[11px]">
                  {t("experiments:detail.locations", { count: locationCount })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text className="text-on-surface mt-3 text-[13px] leading-5">
          {description.length > 0
            ? isDescriptionExpanded
              ? description
              : ellipsize(description, DESCRIPTION_PREVIEW_LENGTH)
            : t("experiments:detail.noDescription")}
        </Text>
        {isDescriptionTruncated ? (
          <Pressable
            onPress={() => setIsDescriptionExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            className="mt-1 active:opacity-60"
          >
            <Text className="text-primary text-[12.5px]">
              {t(
                isDescriptionExpanded
                  ? "experiments:detail.showLess"
                  : "experiments:detail.showMore",
              )}
            </Text>
          </Pressable>
        ) : null}

        {since ? (
          <View className={ROW_CLASS}>
            <Text className="text-muted-body text-[13px]">{t("experiments:detail.since")}</Text>
            <Text className="text-on-surface text-[13px]">{since}</Text>
          </View>
        ) : null}

        {isArchived ? (
          <View className="mt-3">
            <Banner
              variant="yellow"
              title={t("experiments:detail.archived")}
              icon={<Archive size={18} color={themeColors.warningFg} />}
            />
          </View>
        ) : (
          <ExperimentJoinCta
            id={experiment.id}
            name={experiment.name}
            status={experiment.status}
            workbookVersionId={experiment.workbookVersionId}
            membershipStatus={membershipStatus}
            onRefreshAccess={refetch}
          />
        )}
      </Card>
    </ScrollView>
  );
}

export default ExperimentDetailScreen;
