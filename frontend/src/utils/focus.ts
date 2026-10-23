import { Platform, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

// Browser modality is authoritative: mouse/touch selection does not paint a
// keyboard ring. Native accessibility focus remains owned by the platform.
export function isFocusVisible(event: NativeSyntheticEvent<TargetedEvent>) {
  if (Platform.OS !== "web") return false;
  return (event.currentTarget as unknown as { matches?: (selector: string) => boolean }).matches?.(":focus-visible") ?? false;
}
