import { ChevronDown } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { useDropdownLogic, DropdownOption } from "~/hooks/useDropdownLogic";

interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export function Dropdown({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = "Select an option",
}: DropdownProps) {
  const logic = useDropdownLogic({ options, selectedValue, onSelect });
  const optionStyles = logic.getOptionStyles();

  const renderDropdownOption = ({ item }: { item: DropdownOption }) => (
    <TouchableOpacity
      style={optionStyles.optionItem}
      onPress={() => logic.handleSelect(item.value)}
    >
      <Text style={optionStyles.optionText}>{item.label}</Text>
      {item.description && (
        <Text style={optionStyles.optionDescription}>{item.description}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: logic.theme.isDark
                ? logic.colors.dark.onSurface
                : logic.colors.light.onSurface,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.dropdownButton,
          {
            backgroundColor: logic.theme.isDark
              ? logic.colors.dark.surface
              : logic.colors.light.surface,
            borderColor: logic.theme.isDark
              ? logic.colors.dark.border
              : logic.colors.light.border,
          },
        ]}
        onPress={logic.openModal}
      >
        <Text
          style={[
            styles.selectedText,
            {
              color: logic.theme.isDark
                ? logic.colors.dark.onSurface
                : logic.colors.light.onSurface,
            },
            !logic.selectedOption && [
              styles.placeholderText,
              {
                color: logic.theme.isDark
                  ? logic.colors.dark.inactive
                  : logic.colors.light.inactive,
              },
            ],
          ]}
        >
          {logic.selectedOption ? logic.selectedOption.label : placeholder}
        </Text>
        <ChevronDown
          size={20}
          color={
            logic.theme.isDark
              ? logic.colors.dark.onSurface
              : logic.colors.light.onSurface
          }
        />
      </TouchableOpacity>

      <Modal
        visible={logic.modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={logic.closeModal}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: logic.theme.isDark
                ? logic.colors.dark.background
                : logic.colors.light.background,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text
              style={[
                styles.modalTitle,
                {
                  color: logic.theme.isDark
                    ? logic.colors.dark.onSurface
                    : logic.colors.light.onSurface,
                },
              ]}
            >
              {label ?? "Select Option"}
            </Text>
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: logic.theme.isDark
                    ? logic.colors.dark.surface
                    : logic.colors.light.surface,
                },
              ]}
              onPress={logic.closeModal}
            >
              <Text
                style={[
                  styles.closeButtonText,
                  {
                    color: logic.theme.isDark
                      ? logic.colors.dark.onSurface
                      : logic.colors.light.onSurface,
                  },
                ]}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={renderDropdownOption}
            style={styles.optionsList}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  dropdownButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedText: {
    flex: 1,
    fontSize: 16,
  },
  placeholderText: {
    fontStyle: "italic",
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  optionsList: {
    flex: 1,
  },
});
