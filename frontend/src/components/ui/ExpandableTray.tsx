import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Platform, StyleSheet, View } from "react-native";
import { nearestTrayStop } from "../../avatar/tray";
import { uiTheme as ui } from "../../theme/theme";
import { UiPressable, UiText } from "./Primitives";
import PaperTexture from "./PaperTexture";

export default function ExpandableTray({ stops, index, onChange, children }: {
  stops: number[]; index: number; onChange: (index: number) => void; children: ReactNode;
}) {
  const height = useRef(new Animated.Value(stops[index])).current;
  const dragStart = useRef(stops[index]);
  const position = useRef(stops[index]);
  const pointerY = useRef<number | null>(null);
  const pointerDragged = useRef(false);
  useEffect(() => {
    position.current = stops[index];
    const animation = Animated.timing(height, { toValue: stops[index], duration: 180, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [height, stops, index]);
  const resize = useCallback((dy: number) => {
    position.current = Math.max(stops[0], Math.min(stops[2], dragStart.current - dy));
    height.setValue(position.current);
  }, [height, stops]);
  const settle = useCallback((velocity = 0) => {
    const target = nearestTrayStop(position.current - velocity * 80, stops);
    position.current = stops[target];
    // A return to the current stop must settle even without a parent state change.
    Animated.timing(height, { toValue: stops[target], duration: 180, useNativeDriver: false }).start();
    onChange(target);
  }, [height, stops, onChange]);
  const responder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => height.stopAnimation(value => { dragStart.current = value; }),
      onPanResponderMove: (_, gesture) => resize(gesture.dy),
      onPanResponderRelease: (_, gesture) => settle(gesture.vy),
      onPanResponderTerminate: () => settle(),
    });
  }, [height, resize, settle]);

  return <Animated.View style={[styles.tray, { height }]} testID="wardrobe-tray">
    <PaperTexture />
    <View {...(Platform.OS === "web" ? {} : responder.panHandlers)}
      onPointerDown={Platform.OS !== "web" ? undefined : event => {
        pointerY.current = event.nativeEvent.pageY;
        pointerDragged.current = false;
        height.stopAnimation(value => { dragStart.current = value; });
        (event.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.nativeEvent.pointerId);
      }}
      onPointerMove={Platform.OS !== "web" ? undefined : event => {
        if (pointerY.current === null) return;
        const dy = event.nativeEvent.pageY - pointerY.current;
        if (Math.abs(dy) > 6) pointerDragged.current = true;
        if (pointerDragged.current) resize(dy);
      }}
      onPointerUp={Platform.OS !== "web" ? undefined : () => {
        if (pointerY.current === null) return;
        if (pointerDragged.current) settle();
        else onChange((index + 1) % stops.length);
        pointerY.current = null;
      }}
      onPointerCancel={Platform.OS !== "web" ? undefined : () => { pointerY.current = null; settle(); }}>
      <UiPressable accessibilityRole={Platform.OS === "web" ? "button" : "adjustable"}
        accessibilityLabel={`Wardrobe, ${["collapsed", "half expanded", "expanded"][index]}. Tap to resize or drag vertically.`}
        accessibilityValue={{ min: 1, max: 3, now: index + 1 }}
        accessibilityActions={[{ name: "increment", label: "Expand wardrobe" }, { name: "decrement", label: "Collapse wardrobe" }]}
        onAccessibilityAction={event => onChange(Math.max(0, Math.min(2, index + (event.nativeEvent.actionName === "increment" ? 1 : -1))))}
        onPress={event => {
          // Pointer releases are handled above; keyboard/assistive clicks have detail 0.
          if (Platform.OS === "web" && (event.nativeEvent as unknown as { detail?: number }).detail) return;
          onChange((index + 1) % stops.length);
        }} style={styles.handle}>
        <View style={styles.grip} />
        <View style={styles.handleRow}><UiText variant="caption" style={styles.label}>Wardrobe</UiText>
          <MaterialCommunityIcons name={index === 2 ? "chevron-down" : "chevron-up"} size={18} color={ui.colors.secondaryText} accessible={false} />
        </View>
      </UiPressable>
    </View>
    {children}
  </Animated.View>;
}

const styles = StyleSheet.create({
  tray: { position: "absolute", bottom: 0, zIndex: 10, width: "100%", maxWidth: 900, alignSelf: "center", backgroundColor: ui.colors.surface,
    borderTopWidth: 2, borderColor: "#B69B70", borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden",
    shadowColor: "#302C21", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: -5 }, elevation: 10 },
  handle: { userSelect: "none", minHeight: 48, alignItems: "center", paddingTop: ui.spacing.sm },
  grip: { height: 4, width: 36, borderRadius: ui.radius.pill, backgroundColor: ui.colors.controlBorder },
  handleRow: { flexDirection: "row", alignItems: "center", gap: ui.spacing.xs },
  label: { color: ui.colors.secondaryText },
});
