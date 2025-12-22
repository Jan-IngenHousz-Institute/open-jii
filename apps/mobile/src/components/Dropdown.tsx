import { ChevronDown } from "lucide-react-native";
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";
import { useTheme } from "~/hooks/use-theme";

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

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
  const theme = useTheme();
  const { colors } = theme;

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((option) => option.value === selectedValue);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ??
        opt.description?.toLowerCase().includes(query) ??
        false,
    );
  }, [options, searchQuery]);

  const ITEM_HEIGHT = 56;
  const MAX_VISIBLE_ITEMS = 6;

  return (
    <View style={styles.container}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
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
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
            borderColor: theme.isDark ? colors.dark.border : colors.light.border,
          },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[
            styles.selectedText,
            {
              color: selectedOption
                ? theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface
                : theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
            },
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown
          size={20}
          color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
              },
            ]}
          >
            <TextInput
              placeholder={placeholder}
              placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
              style={[
                styles.searchInput,
                {
                  color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  borderColor: theme.isDark ? colors.dark.border : colors.light.border,
                  backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
                },
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <View style={[styles.listWrapper, { height: ITEM_HEIGHT * MAX_VISIBLE_ITEMS }]}>
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      selectedValue === item.value && {
                        backgroundColor: colors.primary.dark + "20",
                      },
                    ]}
                    onPress={() => {
                      onSelect(item.value);
                      setModalVisible(false);
                      setSearchQuery("");
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color:
                              selectedValue === item.value
                                ? colors.primary.dark
                                : theme.isDark
                                  ? colors.dark.onSurface
                                  : colors.light.onSurface,
                            fontWeight: selectedValue === item.value ? "bold" : "normal",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.description && (
                        <Text
                          style={{
                            fontSize: 14,
                            marginTop: 4,
                            color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                          }}
                        >
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: "center",
                      padding: 16,
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    }}
                  >
                    No results found
                  </Text>
                }
              />
            </View>
          </View>
        </Pressable>
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
  },
  dropdownButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    borderRadius: 12,
    width: "100%",
    maxHeight: "80%",
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  listWrapper: {
    flexGrow: 0,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
  },
});
