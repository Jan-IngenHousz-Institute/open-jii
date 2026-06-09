import { FlashList } from "@shopify/flash-list";
import { clsx } from "clsx";
import { Check } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { View, Text } from "react-native";
import { calculateGridLayout } from "~/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/question-node/question-types/utils/grid-layout";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { FlowNode } from "../../../../types";

interface MultipleChoiceQuestionProps {
  node: FlowNode;
  selectedValue: string;
  onSelect: (value: string) => void;
  disabledOptions?: string[];
  searchTerm?: string;
}

const ROW_GAP = 8;

export function MultipleChoiceQuestion({
  node,
  selectedValue,
  onSelect,
  disabledOptions = [],
  searchTerm = "",
}: MultipleChoiceQuestionProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const content = node.content;

  const filteredOptions = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return content.options ?? [];
    return content.options?.filter((option) => option.toLowerCase().includes(needle)) ?? [];
  }, [content.options, searchTerm]);

  const numOptions = filteredOptions.length;
  const { layout, columns, buttonHeight, buttonWidth } = useMemo(
    () => calculateGridLayout(filteredOptions),
    [filteredOptions],
  );
  const isList = layout === "list";
  const fontSize = isList ? 16 : numOptions <= 2 ? 16 : numOptions <= 4 ? 14 : 12;

  const handleOptionSelect = useCallback(
    (value: string) => {
      if (disabledOptions.includes(value)) return;
      // Optional questions toggle off when re-tapped; required ones stay set.
      const next = !content.required && selectedValue === value ? "" : value;
      onSelect(next);
    },
    [content.required, disabledOptions, onSelect, selectedValue],
  );

  const renderItem = useCallback(
    ({ item: option }: { item: string }) => {
      const isSelected = selectedValue === option;
      const isDisabled = disabledOptions.includes(option);
      return (
        <Button
          title={option}
          variant={isSelected ? "tertiary" : "light"}
          style={{ width: buttonWidth, minHeight: buttonHeight }}
          textStyle={{ fontSize }}
          multiline
          numberOfLines={isList ? undefined : 2}
          ellipsizeMode="tail"
          onPress={() => handleOptionSelect(option)}
          isDisabled={isDisabled}
          icon={isSelected ? <Check size={16} color="#005E5E" strokeWidth={3} /> : undefined}
          iconPosition="right"
        />
      );
    },
    [
      buttonHeight,
      buttonWidth,
      disabledOptions,
      fontSize,
      handleOptionSelect,
      isList,
      selectedValue,
    ],
  );

  return (
    <View className="flex-1 gap-2">
      {content.required && !selectedValue && (
        <Text className="text-destructive text-center text-sm">
          {t("measurementFlow:questionTypes.multipleChoice.selectionRequired")}
        </Text>
      )}
      <View className="flex-1">
        <FlashList
          data={filteredOptions}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${index}-${item}`}
          numColumns={columns}
          contentContainerStyle={{ paddingBottom: ROW_GAP }}
          ItemSeparatorComponent={() => <View style={{ height: ROW_GAP }} />}
          extraData={selectedValue}
        />
      </View>

      {disabledOptions.length > 0 && (
        <Text className={clsx("mt-3 text-center text-xs", classes.textMuted)}>
          {t("measurementFlow:questionTypes.multipleChoice.disabledHint")}
        </Text>
      )}
    </View>
  );
}
