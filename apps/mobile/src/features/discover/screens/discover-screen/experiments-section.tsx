import { router } from "expo-router";
import { KeyRound } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { DiscoverEmptyState } from "~/features/discover/components/discover-empty-state";
import { DiscoverExperimentRow } from "~/features/discover/components/discover-experiment-row";
import { useDiscoverExperiments } from "~/features/experiments/hooks/use-discover-experiments";
import { useJoinCodeEntrySheet } from "~/features/experiments/hooks/use-join-code-entry-sheet";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface ExperimentsSectionProps {
  /** Already debounced by the hub; both sections read the same term. */
  search: string;
  enabled: boolean;
  onStatusChange: (status: { count: number; isFetching: boolean }) => void;
}

export function ExperimentsSection({ search, enabled, onStatusChange }: ExperimentsSectionProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["discover", "common"]);
  const { open: openCodeSheet, sheet: codeSheet } = useJoinCodeEntrySheet();

  const {
    experiments,
    totalCount,
    isLoading,
    isFetching,
    isPaused,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useDiscoverExperiments({ search, enabled });

  const count = totalCount ?? experiments?.length ?? 0;
  useEffect(() => {
    onStatusChange({ count, isFetching });
  }, [count, isFetching, onStatusChange]);

  const openExperiment = useCallback((id: string) => {
    router.push({ pathname: "/discover/[id]", params: { id } });
  }, []);

  const hasAppliedTerm = search.trim().length > 0;

  const joinCodeRow = (
    <>
      <Card padded={false} style={{ marginTop: 10 }}>
        <RowItem
          icon={<KeyRound size={18} color={colors.jii.darkGreen} />}
          iconBackgroundClassName="bg-jii-mint"
          title={t("discover:haveCode")}
          subtitle={t("discover:haveCodeHint")}
          onPress={openCodeSheet}
          isLast
        />
      </Card>
      {codeSheet}
    </>
  );

  if (isLoading) {
    return (
      <View className="flex-1">
        <View className="px-4">{joinCodeRow}</View>
        <View className="items-center py-10">
          <ActivityIndicator size="large" color={themeColors.brand} />
          <Text className="text-muted-body mt-3 text-center">{t("discover:loading")}</Text>
        </View>
      </View>
    );
  }

  if (!experiments || (error && experiments.length === 0)) {
    return (
      <View className="flex-1">
        <View className="px-4">{joinCodeRow}</View>
        <View className="items-center gap-3 py-10">
          {/* Paused means offlineFirst gave up before the network, so there is
              no error to report as one. */}
          <Text className="text-error text-center">
            {t(isPaused && !error ? "discover:offline" : "discover:loadFailed")}
          </Text>
          <Button title={t("common:retry")} onPress={() => void refetch()} variant="light" />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={experiments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={themeColors.brand}
          colors={[themeColors.brand]}
        />
      }
      ListHeaderComponent={joinCodeRow}
      ListEmptyComponent={<DiscoverEmptyState hasSearchTerm={hasAppliedTerm} />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-6">
            <ActivityIndicator size="small" color={themeColors.brand} />
          </View>
        ) : null
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      renderItem={({ item }) => (
        <DiscoverExperimentRow experiment={item} onPress={openExperiment} />
      )}
    />
  );
}
