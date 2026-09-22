import { useLocalSearchParams, useNavigation } from "expo-router";
import { Archive } from "lucide-react-native";
import React, { useLayoutEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ExperimentJoinCta } from "~/features/experiments/components/experiment-join-cta";
import { ExperimentMembershipTag } from "~/features/experiments/components/experiment-membership-tag";
import { ExperimentOpenOnWebButton } from "~/features/experiments/components/experiment-open-on-web-button";
import { ExperimentUnavailable } from "~/features/experiments/components/experiment-unavailable";
import { useExperimentAccess } from "~/features/experiments/hooks/use-experiment-access";
import { useTranslation } from "~/shared/i18n";
import { Banner } from "~/shared/ui/Banner";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { ellipsize } from "~/shared/utils/ellipsize";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

const DESCRIPTION_PREVIEW_LENGTH = 220;

export function ExperimentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "experiments"]);
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
  // Authored in web's rich-text editor, so it arrives as HTML.
  const description = experiment.description
    ? extractTextFromHTML(experiment.description).trim()
    : "";
  const isDescriptionTruncated = description.length > DESCRIPTION_PREVIEW_LENGTH;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card padded>
        <View className="flex-row items-center gap-2">
          <Text
            className="text-on-surface min-w-0 shrink"
            style={{ fontFamily: "Poppins-Bold", fontSize: 17, lineHeight: 22 }}
            numberOfLines={2}
          >
            {experiment.name}
          </Text>
          <View className="shrink-0">
            <ExperimentMembershipTag membershipStatus={membershipStatus} />
          </View>
        </View>

        {experiment.organizationName ? (
          <Text className="text-muted-body mt-0.5 text-[12.5px]">
            {experiment.organizationName}
          </Text>
        ) : null}

        {typeof experiment.membersCount === "number" ? (
          <Text className="text-muted-body mt-0.5 text-[12.5px]">
            {t("experiments:detail.collaborators", { count: experiment.membersCount })}
          </Text>
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
