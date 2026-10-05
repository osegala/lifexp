import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { Platform, Text, View, StyleSheet } from "react-native";

import CompletionFeedback from "../components/CompletionFeedback";
import { completionAnnouncement, completionEvent, completionQueue, EMPTY_COMPLETION_QUEUE } from "../feedback/completion";
import type { CompletionResponse, User } from "../types";
import type { BuildingUpgradeBatch } from "../base/buildingProgress";

type ConfirmCompletion = (response: CompletionResponse, previousUser?: User | null) => void;
const CompletionContext = createContext<ConfirmCompletion | null>(null);
const BuildingFeedbackContext = createContext<{
  pending: BuildingUpgradeBatch | undefined;
  enqueue: (batch: BuildingUpgradeBatch) => void;
  finish: (id: string) => void;
} | null>(null);

/** Session-only feedback queues; never write profile/world state. */
export function CompletionFeedbackProvider({ children }: { children: ReactNode }) {
  const [queue, dispatch] = useReducer(completionQueue, EMPTY_COMPLETION_QUEUE);
  const celebrate = useCallback<ConfirmCompletion>((response, user) => {
    dispatch({ type: "enqueue", event: completionEvent(response, user) });
  }, []);
  const finish = useCallback((id: string) => dispatch({ type: "finish", id }), []);
  const current = queue.pending[0];
  const enqueueBuildings = useCallback((batch: BuildingUpgradeBatch) => dispatch({ type: "buildings", batch }), []);
  const finishBuildings = useCallback((id: string) => dispatch({ type: "finishBuildings", id }), []);
  const buildings = useMemo(() => ({
    // Keep XP / level / achievement feedback in its existing order, then reveal the world upgrade.
    pending: current ? undefined : queue.buildings[0], enqueue: enqueueBuildings, finish: finishBuildings,
  }), [current, queue.buildings, enqueueBuildings, finishBuildings]);
  const feedback = useMemo(() => current
    ? <CompletionFeedback key={current.id} event={current} onDone={finish} /> : null, [current, finish]);
  return (
    <CompletionContext.Provider value={celebrate}>
      <BuildingFeedbackContext.Provider value={buildings}>
        <View style={styles.root}>
          {children}
          {Platform.OS === "web" && <Text role="status" aria-live="polite" aria-atomic style={styles.announcement}>
            {current ? completionAnnouncement(current) : ""}
          </Text>}
          {feedback}
        </View>
      </BuildingFeedbackContext.Provider>
    </CompletionContext.Provider>
  );
}

export function useBuildingFeedback() {
  const value = useContext(BuildingFeedbackContext);
  if (!value) throw new Error("useBuildingFeedback must be inside CompletionFeedbackProvider");
  return value;
}

export function useCompletionFeedback() {
  const value = useContext(CompletionContext);
  if (!value) throw new Error("useCompletionFeedback must be inside CompletionFeedbackProvider");
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Mounted before the first event so browser screen readers observe text updates.
  announcement: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 },
});
