import { View, StyleSheet } from "react-native";
import { colors, radius } from "../theme/theme";

type Props = {
  progress: number;
};

export default function XPBar({ progress }: Props) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.fill,
          { width: `${Math.min(progress * 100, 100)}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 18,
    backgroundColor: colors.cardLight,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
});