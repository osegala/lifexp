import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { api } from "../api/client";
import { AuthSession } from "../auth/session";
import { cognitoAuth } from "../auth/cognito";
import { disableCurrentDevice, enableDeviceNotifications, watchDeviceToken } from "../notifications/device";
import { BillingClient } from "../billing/client";
import { billingProvider } from "../billing/provider";
import { apiRoutes } from "../api/routes";
import type { AxiosRequestConfig } from "axios";

function useSessionValue() {
  const [session] = useState(() => new AuthSession(api, cognitoAuth));
  const [billing] = useState(() => new BillingClient(billingProvider, async userId => {
    await api.post(apiRoutes.billingSync, {}, { expectedUserId: userId } as AxiosRequestConfig);
    if (String(session.getSnapshot().user?.id) !== userId) throw new Error("Account changed");
    if (!await session.refreshEntitlements()) throw new Error("Plan refresh failed");
    if (String(session.getSnapshot().user?.id) !== userId) throw new Error("Account changed");
    return session.getSnapshot().entitlements.premium;
  }));
  const billingState = useSyncExternalStore(billing.subscribe, billing.getSnapshot, billing.getSnapshot);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const billingUserId = snapshot.user ? String(snapshot.user.id) : null;

  useEffect(() => session.start(), [session]);
  useEffect(() => { void billing.identify(billingUserId); }, [billing, billingUserId]);

  useEffect(() => {
    if (!snapshot.user?.id) return;
    let active = true, remove = () => {};
    void enableDeviceNotifications(false);
    void watchDeviceToken().then(cleanup => { if (active) remove = cleanup; else cleanup(); });
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void enableDeviceNotifications(false); });
    return () => { active = false; remove(); subscription.remove(); };
  }, [snapshot.user?.id]);

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
  const logout = useCallback(async () => {
    await disableCurrentDevice();
    await billing.identify(null);
    await session.logout();
  }, [session, billing]);
  const clearDeletedAccountSession = useCallback(async () => {
    await billing.identify(null);
    await session.clearDeletedAccountSession();
  }, [billing, session]);

  return useMemo(() => ({
    ...snapshot,
    billing,
    billingState,
    dashboardRefreshKey,
    triggerDashboardRefresh,
    login: session.login,
    register: session.register,
    confirmRegistration: session.confirmRegistration,
    logout,
    clearDeletedAccountSession,
    refreshUser: session.refreshUser,
    refreshEntitlements: session.refreshEntitlements,
    retrySession: session.retrySession,
  }), [snapshot, billing, billingState, dashboardRefreshKey, triggerDashboardRefresh, session, logout, clearDeletedAccountSession]);
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
