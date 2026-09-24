import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { api } from "../api/client";
import { AuthSession } from "../auth/session";
import { cognitoAuth } from "../auth/cognito";

function useSessionValue() {
  const [session] = useState(() => new AuthSession(api, cognitoAuth));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => session.start(), [session]);

  useEffect(() => {
    const retry = () => {
      const current = session.getSnapshot();
      if (!current.loading && (current.token || current.sessionError)) void session.retrySession();
    };
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") retry();
    });
    if (Platform.OS === "web") window.addEventListener("online", retry);
    return () => {
      subscription.remove();
      if (Platform.OS === "web") window.removeEventListener("online", retry);
    };
  }, [session]);

  const triggerDashboardRefresh = useCallback(() => setDashboardRefreshKey(value => value + 1), []);

  return useMemo(() => ({
    ...snapshot,
    dashboardRefreshKey,
    triggerDashboardRefresh,
    login: session.login,
    register: session.register,
    confirmRegistration: session.confirmRegistration,
    logout: session.logout,
    refreshUser: session.refreshUser,
    retrySession: session.retrySession,
  }), [snapshot, dashboardRefreshKey, triggerDashboardRefresh, session]);
}

const AuthContext = createContext<ReturnType<typeof useSessionValue> | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useSessionValue();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
