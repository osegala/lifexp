import { Image, StyleSheet, View, type ViewProps } from "react-native";
import { fantasyImages } from "../../theme/fantasyMaterials";
import { uiTheme as ui } from "../../theme/theme";

/** Illustrated paper extends under the safe area. Equipped Avatar scenes opt
 * out of the extra imagery; the Base world does not use this component. */
export default function PageBackground({ children, style, illustrated = true, ...props }: ViewProps & { illustrated?: boolean }) {
  return <View {...props} style={[styles.page, style]}>
    {illustrated && <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} aria-hidden accessibilityElementsHidden>
      <Image source={fantasyImages.screen} resizeMode="cover" style={styles.paper} accessible={false} />
      <Image source={fantasyImages.vignette} resizeMode="cover" style={styles.vignette} accessible={false} />
    </View>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: ui.colors.ivory },
  paper: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", opacity: 0.72 },
  vignette: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", opacity: 0.035 },
});
