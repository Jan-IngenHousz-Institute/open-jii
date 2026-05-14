import { ChevronDown } from "lucide-react-native";
import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, Pressable, TextInput } from "react-native";
import { useThemeColors } from "~/hooks/use-theme-colors";

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
  const themeColors = useThemeColors();

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
    <View className="mb-4">
      {label && <Text className="text-on-surface mb-1.5 text-sm">{label}</Text>}

      <TouchableOpacity
        className="border-border flex-row items-center justify-between rounded-xl border px-3 py-2.5"
        onPress={() => setModalVisible(true)}
      >
        <Text className={`text-base ${selectedOption ? "text-on-surface" : "text-inactive"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={24} color={themeColors.onSurface} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 p-4"
          onPress={() => setModalVisible(false)}
        >
          <View className="bg-background max-h-[80%] w-full rounded-xl p-4">
            <TextInput
              placeholder={placeholder}
              placeholderTextColor={themeColors.inactive}
              className="border-border bg-surface text-on-surface mb-4 rounded-lg border px-3 py-2 text-base"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <View style={{ height: ITEM_HEIGHT * MAX_VISIBLE_ITEMS, flexGrow: 0 }}>
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
                renderItem={({ item }) => {
                  const isSelected = selectedValue === item.value;
                  return (
                    <TouchableOpacity
                      className={`rounded-lg px-4 py-3 ${isSelected ? "bg-jii-primary/20" : ""}`}
                      onPress={() => {
                        onSelect(item.value);
                        setModalVisible(false);
                        setSearchQuery("");
                      }}
                    >
                      <View>
                        <Text
                          className={`text-base ${
                            isSelected ? "text-jii-primary font-bold" : "text-on-surface"
                          }`}
                        >
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text className="text-inactive mt-1 text-sm">{item.description}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text className="text-inactive p-4 text-center">No results found</Text>
                }
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
