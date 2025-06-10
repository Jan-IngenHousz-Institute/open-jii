import { useState } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "./useTheme";

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

export interface UseDropdownLogicProps {
  options: DropdownOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
}

export function useDropdownLogic({
  options,
  selectedValue,
  onSelect,
}: UseDropdownLogicProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setModalVisible(false);
  };

  const openModal = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  // Styles for the dropdown options
  const getOptionStyles = () =>
    StyleSheet.create({
      optionItem: {
        padding: 16,
        borderBottomWidth: 1,
        backgroundColor: theme.isDark
          ? colors.dark.surface
          : colors.light.surface,
        borderBottomColor: theme.isDark
          ? colors.dark.border
          : colors.light.border,
      },
      optionText: {
        fontSize: 16,
        fontWeight: "500",
        color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
      },
      optionDescription: {
        fontSize: 14,
        marginTop: 4,
        color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
      },
    });

  return {
    theme,
    colors,
    modalVisible,
    selectedOption,
    handleSelect,
    openModal,
    closeModal,
    getOptionStyles,
  };
}
