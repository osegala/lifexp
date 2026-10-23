import { Image, StyleSheet, View } from "react-native";
import { fantasyImages } from "../../theme/fantasyMaterials";

/** Unframed illustrated paper for inventory cells and the wardrobe tray. */
export default function PaperTexture() {
  return <View pointerEvents="none" style={styles.clip} accessible={false} aria-hidden accessibilityElementsHidden>
    <Image source={fantasyImages.paper} accessible={false} importantForAccessibility="no-hide-descendants"
      resizeMode="cover" style={styles.paper} />
  </View>;
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, borderRadius: 4, overflow: "hidden" },
  paper: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", opacity: 0.6 },
});
