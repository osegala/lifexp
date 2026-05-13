import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getToken,
  setToken as saveToken,
  deleteToken,
} from "../utils/tokenStorage";
import { api } from "../api/client";
import { AuthResponse, User } from "../types";

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  dashboardRefreshKey: number;
  triggerDashboardRefresh: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  async function loadToken() {
    try {
      const savedToken = await getToken();

      if (savedToken) {
        setToken(savedToken);

        const response = await api.get<User>("/users/me");
        setUser(response.data);
      }
    } catch {
      await deleteToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadToken();
  }, []);

  async function login(email: string, password: string) {
    const response = await api.post<AuthResponse>("/users/login", {
      email,
      password,
    });

    await saveToken(response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
  }

  async function register(username: string, email: string, password: string) {
    const response = await api.post<AuthResponse>("/users/register", {
      username,
      email,
      password,
    });

    await saveToken(response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
  }

  async function refreshUser() {
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
    } catch (error) {
      console.log("Refresh user error:", error);
      await deleteToken();
      setToken(null);
      setUser(null);
    }
  }

  async function logout() {
    await deleteToken();
    setToken(null);
    setUser(null);
  }

  function triggerDashboardRefresh() {
    setDashboardRefreshKey((prev) => prev + 1);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        dashboardRefreshKey,
        triggerDashboardRefresh,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
