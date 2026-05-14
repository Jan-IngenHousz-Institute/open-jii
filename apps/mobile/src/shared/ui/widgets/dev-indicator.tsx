import { HardHat, User } from "lucide-react-native";
import { View, Text } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useIsDevelopment } from "~/features/profile/hooks/use-is-development";

interface Props {
  size: number;
  color: string;
}

export function DevIndicator({ size, color, focused }: Props & { focused?: boolean }) {
  const isDevelopment = useIsDevelopment();

  if (!isDevelopment) {
    return <User size={size} color={color} />;
  }

  const devColor = focused ? colors.semantic.warning : "#FCD34B";

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <HardHat size={size} color={devColor} strokeWidth={2.5} />

      <View
        style={{
          bottom: -size * 0.1,
          right: -size * 0.1,
          backgroundColor: devColor,
        }}
        className="border-surface absolute rounded-[3px] border-[1.5px] px-[3px]"
      >
        <Text style={{ fontSize: size * 0.25 }} className="text-surface font-black">
          DEV
        </Text>
      </View>
    </View>
  );
}
