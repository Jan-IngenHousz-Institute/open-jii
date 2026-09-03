import { ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface MacroFieldGridProps {
  fields: { name: string; value?: string }[];
  /** Renders names only, dimmed: the macro reported these without a value. */
  muted?: boolean;
}

/**
 * Two-column grid of macro fields. A macro run reports many small values at
 * once, so a full-width row each turns the result into a long scroll.
 */
export function MacroFieldGrid({ fields, muted = false }: MacroFieldGridProps) {
  return (
    <View className="flex-row flex-wrap">
      {fields.map((field, index) => (
        <View key={`${index}-${field.name}`} className="w-1/2 py-2 pr-3">
          <Text
            className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide"
            numberOfLines={1}
          >
            {field.name}
          </Text>
          <Text
            className={
              muted ? "text-muted-foreground text-sm" : "text-on-surface text-[15px] font-semibold"
            }
            numberOfLines={2}
          >
            {muted ? "-" : field.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface MacroFieldDisclosureProps {
  label: string;
  children: React.ReactNode;
}

/** Collapsed-by-default section, so secondary output stays reachable but quiet. */
export function MacroFieldDisclosure({ label, children }: MacroFieldDisclosureProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <View className="border-border rounded-xl border">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2.5"
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
      >
        <Chevron size={16} color={colors.inactive} />
        <Text className="text-muted-foreground text-sm font-semibold">{label}</Text>
      </Pressable>
      {open && <View className="px-3 pb-3">{children}</View>}
    </View>
  );
}
