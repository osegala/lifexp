import { useState } from "react";
import type { TextInputProps } from "react-native";
import { formatDate, formatTime, parseDisplayDate, parseDisplayTime } from "../utils/dateFormat";
import LifeInput from "./LifeInput";

/** Friendly display at the field boundary; callers still validate and save ISO
 * calendar dates / HH:mm wall clocks using their existing code. */
export default function ScheduleInput({ kind, value, onChangeText, onBlur, ...props }:
  Omit<TextInputProps, "value" | "onChangeText"> & { kind: "date" | "time"; value: string; onChangeText: (value: string) => void; tone?: "legacy" | "parchment" }) {
  const parse = kind === "date" ? parseDisplayDate : parseDisplayTime;
  const display = (text: string) => !text ? "" : parse(text) === null ? text
    : kind === "date" ? formatDate(text, { year: true }) : formatTime(text);
  const [edit, setEdit] = useState({ draft: display(value), canonical: value });
  return <LifeInput {...props} autoCorrect={false} value={edit.canonical === value ? edit.draft : display(value)}
    onChangeText={draft => {
      const canonical = parse(draft) ?? draft;
      setEdit({ draft, canonical });
      onChangeText(canonical);
    }} onBlur={event => { setEdit({ draft: display(value), canonical: value }); onBlur?.(event); }} />;
}
