import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

interface DropdownOption {
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

export default function Dropdown({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
}: DropdownProps) {
  const theme = useTheme();
  const { colors } = theme;
  
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedOption = options.find(option => option.value === selectedValue);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[
          styles.label, 
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface }
        ]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity 
        style={[
          styles.dropdownButton,
          { 
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
            borderColor: theme.isDark ? colors.dark.border : colors.light.border
          }
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[
          styles.selectedText,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          !selectedOption && [
            styles.placeholderText, 
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive }
          ]
        ]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={20} color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={[
            styles.modalContent,
            { backgroundColor: theme.isDark ? colors.dark.background : colors.light.background }
          ]}>
            <Text style={[
              styles.modalTitle,
              { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface }
            ]}>
              {label || 'Select an option'}
            </Text>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    selectedValue === item.value && [
                      styles.selectedItem,
                      { backgroundColor: colors.primary.dark + '20' }
                    ]
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={[
                      styles.optionText,
                      { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
                      selectedValue === item.value && [
                        styles.selectedItemText,
                        { color: colors.primary.dark }
                      ]
                    ]}>
                      {item.label}
                    </Text>
                    {item.description && (
                      <Text style={[
                        styles.descriptionText,
                        { color: theme.isDark ? colors.dark.inactive : colors.light.inactive }
                      ]}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 16,
  },
  placeholderText: {
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectedItem: {
  },
  optionText: {
    fontSize: 16,
  },
  selectedItemText: {
    fontWeight: 'bold',
  },
  descriptionText: {
    fontSize: 14,
    marginTop: 4,
  },
});