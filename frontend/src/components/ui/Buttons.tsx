import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet } from "react-native";
import LifeButton from "../LifeButton";
import { UiPressable } from "./Primitives";
import ButtonSurface, { buttonHitArea, type ButtonVariant } from "./ButtonSurface";
import { uiTheme as ui } from "../../theme/theme";

type ButtonProps = Omit<ComponentProps<typeof LifeButton>, "variant" | "tone">;

export function PrimaryButton(props: ButtonProps) {
  return <LifeButton {...props} tone="parchment" variant="primary" />;
}

export function SecondaryButton(props: ButtonProps) {
  return <LifeButton {...props} tone="parchment" variant="secondary" />;
}

export function DestructiveButton(props: ButtonProps) {
  return <LifeButton {...props} tone="parchment" variant="danger" />;
}

type UtilityProps = Omit<ComponentProps<typeof UiPressable>, "children" | "style"> & {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  accessibilityLabel: string;
  variant?: Exclude<ButtonVariant, "danger">;
};

export function IconUtilityButton({ icon, disabled, accessibilityState, variant = "secondary", ...props }: UtilityProps) {
  return <UiPressable {...props} disabled={disabled} accessibilityRole="button"
    accessibilityState={{ ...accessibilityState, disabled: !!disabled }} style={[styles.utility, buttonHitArea]}>
    <ButtonSurface variant={variant} disabled={!!disabled} />
    <MaterialCommunityIcons name={icon} size={ui.size.icon}
      color={disabled ? ui.colors.disabledText : variant === "primary" ? ui.colors.onPrimary : ui.colors.primary} accessible={false} aria-hidden />
  </UiPressable>;
}

const styles = StyleSheet.create({
  utility: { width: ui.size.target, height: ui.size.target, alignItems: "center", justifyContent: "center" },
});
