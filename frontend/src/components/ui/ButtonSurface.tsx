import { useId, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

export type ButtonVariant = "primary" | "secondary" | "danger";

// The press target owns layout only. All visible pixels belong to the bezel.
export const buttonHitArea = StyleSheet.create({
  transparent: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, shadowOpacity: 0, elevation: 0 },
}).transparent;

/** Fixed-size, cut-in shoulders retain the framed silhouette on narrow icon
 * buttons and wide CTAs. Both paths stay inside the native SVG viewport. */
export function buttonBezelPath(width: number, height: number, inset: number) {
  const corner = Math.min(18, width / 3, height / 2);
  const x = inset, y = inset, right = width - inset, bottom = height - inset;
  const c = Math.max(0, corner - inset);
  return `M ${x + c} ${y} H ${right - c}
    Q ${right - c * 0.8} ${y + c * 0.4} ${right - c * 0.4} ${y + c * 0.55}
    Q ${right} ${y + c * 0.7} ${right} ${y + c}
    V ${bottom - c}
    Q ${right} ${bottom - c * 0.7} ${right - c * 0.4} ${bottom - c * 0.55}
    Q ${right - c * 0.8} ${bottom - c * 0.4} ${right - c} ${bottom}
    H ${x + c}
    Q ${x + c * 0.8} ${bottom - c * 0.4} ${x + c * 0.4} ${bottom - c * 0.55}
    Q ${x} ${bottom - c * 0.7} ${x} ${bottom - c}
    V ${y + c}
    Q ${x} ${y + c * 0.7} ${x + c * 0.4} ${y + c * 0.55}
    Q ${x + c * 0.8} ${y + c * 0.4} ${x + c} ${y} Z`;
}

const fills = {
  primary: ["#39634F", "#204B3A", "#15392E"],
  secondary: ["#FCEDD4", "#F2E1C3", "#E5CCA2"],
  danger: ["#963E35", "#7D322D", "#622B2A"],
  disabled: ["#E6DCC9", "#D8CBB4", "#CCBDA2"],
} as const;

/** One gold bezel and one inset face, with no painted rectangular backing.
 * Native SVG paths give iOS the same transparent silhouette as web. */
export default function ButtonSurface({ variant = "primary", disabled = false }: { variant?: ButtonVariant; disabled?: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = useId().replace(/\W/g, "");
  const fill = fills[disabled ? "disabled" : variant];
  return <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}
    onLayout={({ nativeEvent: { layout: { width, height } } }) => {
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    }}>
    {size.width > 0 && size.height > 0 && <Svg width="100%" height="100%" pointerEvents="none"
      {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })}>
      <Defs>
        <LinearGradient id={`${id}rim`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={disabled ? "#B9A17B" : "#E9CB88"} />
          <Stop offset="0.22" stopColor={disabled ? "#A18C6B" : "#B68A49"} />
          <Stop offset="0.48" stopColor={disabled ? "#CEBB98" : "#F0D59A"} />
          <Stop offset="1" stopColor={disabled ? "#A18C6B" : "#A67B40"} />
        </LinearGradient>
        <LinearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fill[0]} /><Stop offset="0.45" stopColor={fill[1]} /><Stop offset="1" stopColor={fill[2]} />
        </LinearGradient>
      </Defs>
      <Path d={buttonBezelPath(size.width, size.height, 0.75)} fill={`url(#${id}rim)`} stroke="#93703E" strokeWidth={0.75} />
      <Path d={buttonBezelPath(size.width, size.height, 3.5)} fill={`url(#${id}face)`}
        stroke={variant === "secondary" || disabled ? "#C0A477" : "#17392C"} strokeWidth={0.75} />
    </Svg>}
  </View>;
}
