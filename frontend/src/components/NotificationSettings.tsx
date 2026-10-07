import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api, apiError } from "../api/client";
import { apiRoutes } from "../api/routes";
import { enableDeviceNotifications, permissionMessage } from "../notifications/device";
import { validClock, type NotificationPreferences } from "../notifications/model";
import { colors, spacing } from "../theme/theme";
import LifeButton from "./LifeButton";
import LifeCard from "./LifeCard";
import LifeInput from "./LifeInput";

const controls = [
  ["notificationsEnabled", "Notifications enabled", null], ["taskRemindersEnabled", "Task reminders", null],
  ["dailyReminderEnabled", "Daily task summary", "dailyReminderTime"],
  ["dailyQuestReminderEnabled", "Daily quest reminder", "dailyQuestReminderTime"],
  ["streakReminderEnabled", "Streak reminder", "streakReminderTime"], ["quietHoursEnabled", "Quiet hours", null],
] as const;

export default function NotificationSettings({ timeZone }: { timeZone: string }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const version = useRef(0);
  const load = useCallback(async () => {
    const request = ++version.current;
    try {
      const result = await api.get<NotificationPreferences>(apiRoutes.preferences);
      if (request === version.current) { setPreferences(result.data); setError(""); }
    } catch { if (request === version.current) setError("Could not load notification settings. Your last settings have not changed."); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current++; }; }, [load]));
  async function enableDevice() { setNotice(permissionMessage[await enableDeviceNotifications()]); }
  function change(field: keyof NotificationPreferences, value: boolean | string) {
    setPreferences(current => current ? { ...current, [field]: value } : current);
    setNotice("");
    if (field === "notificationsEnabled" && value) void enableDevice();
  }
  async function save() {
    if (!preferences || pending.current) return;
    const patch = Object.fromEntries(controls.flatMap(([enabled, , clock]) => [
      [enabled, preferences[enabled]], ...(clock ? [[clock, preferences[clock] ?? "09:00"]] : [])
    ]));
    patch.quietHoursStart = preferences.quietHoursStart; patch.quietHoursEnd = preferences.quietHoursEnd;
    for (const [, label, clock] of controls) if (clock && !validClock(String(patch[clock]))) return setError(`${label}: use a 24-hour time in HH:mm format.`);
    if (!validClock(preferences.quietHoursStart) || !validClock(preferences.quietHoursEnd)) return setError("Quiet hours need valid 24-hour HH:mm times.");
    if (preferences.quietHoursEnabled && preferences.quietHoursStart === preferences.quietHoursEnd) return setError("Quiet hours must have different start and end times.");
    pending.current = true; setSaving(true); setError(""); version.current++;
    try {
      if (preferences.notificationsEnabled) await enableDevice();
      const result = await api.patch<NotificationPreferences>(apiRoutes.preferences, patch);
      setPreferences(result.data); setNotice(current => `Settings saved. ${current}`);
    } catch (failure) { setError(apiError(failure, "Could not save notification settings. Retry when connected.").message); }
    finally { pending.current = false; setSaving(false); }
  }
  return <LifeCard><View style={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Notifications & reminders</Text>
    <Text style={styles.hint}>All times use {timeZone}. Notifications never complete tasks or grant rewards.</Text>
    {!preferences ? <Text style={styles.hint}>Load your saved notification preferences to edit them.</Text> : <>
      {controls.map(([enabled, label, clock]) => <View key={enabled} style={styles.content}>
        <View style={styles.row}><Text style={styles.label}>{label} · {preferences[enabled] ? "On" : "Off"}</Text>
          <Switch accessibilityLabel={label} accessibilityState={{ checked: preferences[enabled], disabled: saving }} value={preferences[enabled]}
            disabled={saving} onValueChange={value => change(enabled, value)} /></View>
        {clock && preferences[enabled] && <><Text style={styles.hint}>{label} time · HH:mm</Text>
          <LifeInput accessibilityLabel={`${label} time, 24-hour HH:mm`} value={preferences[clock] ?? "09:00"}
            onChangeText={value => change(clock, value)} editable={!saving} autoCapitalize="none" maxLength={5} /></>}
      </View>)}
      {preferences.quietHoursEnabled && <>{([['quietHoursStart', 'Quiet hours start'], ['quietHoursEnd', 'Quiet hours end']] as const).map(([field, label]) => <View key={field}>
        <Text style={styles.hint}>{label} · HH:mm</Text><LifeInput accessibilityLabel={`${label}, 24-hour HH:mm`} value={preferences[field]}
          onChangeText={value => change(field, value)} editable={!saving} maxLength={5} />
      </View>)}</>}
      <Text style={styles.hint}>Quiet hours suppress notifications, not delay them. Overnight ranges such as 22:00–07:00 are supported. Daily quests and streak reminders are skipped when already completed.</Text>
      <LifeButton title={saving ? "Saving…" : "Save notification settings"} onPress={() => void save()} disabled={saving} />
      <LifeButton title="Enable notifications on this device" onPress={() => void enableDevice()} disabled={saving || !preferences.notificationsEnabled} />
    </>}
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.label}>Reload notification settings</Text></Pressable></>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
  </View></LifeCard>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.sm }, heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, minHeight: 44 },
  label: { color: colors.text, flexShrink: 1 }, hint: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger }, retry: { minHeight: 44, justifyContent: "center" },
});
