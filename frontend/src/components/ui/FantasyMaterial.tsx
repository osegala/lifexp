import { memo, useState } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { fantasyMaterials } from "../../theme/fantasyMaterials";
import { nineSliceRegions } from "../../theme/nineSlice";

/** Native View clipping preserves the painted corners without nested SVG
 * viewport positioning or platform-specific Image capInsets. */
export default memo(function FantasyMaterial({ kind, opacity = 1 }: { kind: keyof typeof fantasyMaterials; opacity?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const material = fantasyMaterials[kind];
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity }]}
    onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    }}>
    {nineSliceRegions(size.width, size.height, material).map((region, index) => {
      const scaleX = region.width / region.sw, scaleY = region.height / region.sh;
      return <View key={index} collapsable={false} style={{ position: "absolute", overflow: "hidden",
        left: region.x, top: region.y, width: region.width, height: region.height }}>
        <Image source={material.source} accessible={false} resizeMode="stretch"
          {...(Platform.OS === "android" ? { fadeDuration: 0 } : {})}
          style={{ position: "absolute", left: -region.sx * scaleX, top: -region.sy * scaleY,
            width: material.width * scaleX, height: material.height * scaleY }} />
      </View>;
    })}
  </View>;
});
