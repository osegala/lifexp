import { useState } from "react";
import {
  Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle,
} from "react-native";

import { croppedImageStyle, ImageCrop } from "../avatar/spriteLayout";

/** A contained item preview, including artwork supplied with transparent margins. */
type Props = {
  source: ImageSourcePropType;
  crop?: ImageCrop;
  style: StyleProp<ViewStyle>;
};

export default function CosmeticImage({ source, crop, style }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  if (!crop) return (
    <View style={style}>
      <Image source={source} style={styles.fullImage} resizeMode="contain" />
    </View>
  );

  const scale = Math.min(size.width / crop.width, size.height / crop.height);
  return (
    <View
      style={[style, styles.container]}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      <View style={{ width: crop.width * scale, height: crop.height * scale, overflow: "hidden" }}>
        <Image
          source={source}
          style={[styles.image, croppedImageStyle(crop)]}
          resizeMode="stretch"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { position: "absolute" },
  fullImage: { width: "100%", height: "100%" },
});
