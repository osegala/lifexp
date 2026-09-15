import { isAxiosError, isCancel } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { AuthResponse, User } from "../types";

type SessionStorage = {
  getToken: () => Promise<string | null>;
  setToken: (token: string) => Promise<void>;
  deleteToken: () => Promise<void>;
};

type SessionState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  sessionNotice: string | null;
};

type SessionRequest = InternalAxiosRequestConfig & { sessionRevision?: number };
const AUTH_TIMEOUT = 15_000;
const isPublicAuthRequest = (url?: string) => /\/users\/(login|register)(?:\?|$)/.test(url ?? "");

/** Owns session transitions independently of screen focus and React renders. */
export class AuthSession {
  private state: SessionState = {
    token: null, user: null, loading: true, sessionError: null, sessionNotice: null,
  };
  private revision = 0;
  private listeners = new Set<() => void>();
  private storageWrites: Promise<void> = Promise.resolve();
  private refresh: { revision: number; promise: Promise<boolean> } | null = null;
  private client: AxiosInstance;
  private storage: SessionStorage;

  constructor(client: AxiosInstance, storage: SessionStorage) {
    this.client = client;
    this.storage = storage;
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  private persist(token: string | null) {
    // A late token deletion must finish before a subsequent sign-in is saved.
    const write = this.storageWrites.then(() => token === null
      ? this.storage.deleteToken() : this.storage.setToken(token));
    this.storageWrites = write.catch(() => {});
    return write;
  }

  start = () => {
    const requestId = this.client.interceptors.request.use(config => {
      (config as SessionRequest).sessionRevision = this.revision;
      if (this.state.token && !isPublicAuthRequest(config.url)) {
        config.headers.set("Authorization", `Bearer ${this.state.token}`);
      } else {
        config.headers.delete("Authorization");
      }
      return config;
    });
    const responseId = this.client.interceptors.response.use(response => response, error => {
      if (isAxiosError(error) && error.response?.status === 401 && !isPublicAuthRequest(error.config?.url)) {
        this.expire((error.config as SessionRequest | undefined)?.sessionRevision);
      }
      return Promise.reject(error);
    });
    void this.restore();
    return () => {
      this.client.interceptors.request.eject(requestId);
      this.client.interceptors.response.eject(responseId);
      this.revision++;
      this.refresh = null;
    };
  };

  private expire(revision: number | undefined) {
    if (revision !== this.revision || !this.state.token) return;
    this.revision++;
    this.update({
      token: null, user: null, loading: false, sessionError: null,
      sessionNotice: "Your session has expired. Please sign in again.",
    });
    // This credential is already invalid on the server, even if local removal fails.
    void this.persist(null).catch(() => {});
  }

  restore = async () => {
    const revision = ++this.revision;
    this.update({ loading: true, sessionError: null });
    try {
      await this.storageWrites;
      const token = await this.storage.getToken();
      if (revision !== this.revision) return false;
      this.update({ token, user: null });
      return token ? await this.refreshUser() : false;
    } catch {
      if (revision === this.revision) {
        this.update({ sessionError: "Couldn't restore your saved sign-in. Please try again." });
      }
      return false;
    } finally {
      if (revision === this.revision) this.update({ loading: false });
    }
  };

  refreshUser = (): Promise<boolean> => {
    if (!this.state.token) return Promise.resolve(false);
    const revision = this.revision;
    if (this.refresh?.revision === revision) return this.refresh.promise;

    const promise = this.fetchUser(revision);
    this.refresh = { revision, promise };
    void promise.finally(() => {
      if (this.refresh?.promise === promise) this.refresh = null;
    });
    return promise;
  };

  private async fetchUser(revision: number) {
    try {
      const response = await this.client.get<User>("/users/me", { timeout: AUTH_TIMEOUT });
      if (revision !== this.revision) return false;
      this.update({ user: response.data, sessionError: null, sessionNotice: null });
      return true;
    } catch (error) {
      if (revision !== this.revision) return false;
      if (isAxiosError(error) && error.response?.status === 401) {
        this.expire(revision);
      } else if (!isCancel(error)) {
        this.update({ sessionError: "Couldn't refresh your account. Your sign-in is saved. Please try again." });
      }
      return false;
    }
  }

  private async acceptAuth(response: AuthResponse, expectedRevision: number) {
    if (expectedRevision !== this.revision) throw new Error("The sign-in attempt is no longer current.");
    const revision = ++this.revision;
    this.update({
      token: response.token, user: response.user, loading: false,
      sessionError: null, sessionNotice: null,
    });
    try {
      await this.persist(response.token);
    } catch (error) {
      if (revision === this.revision) {
        this.revision++;
        this.update({ token: null, user: null, sessionNotice: "Couldn't save your sign-in. Please try again." });
      }
      throw error;
    }
  }

  login = async (email: string, password: string) => {
    const revision = this.revision;
    const response = await this.client.post<AuthResponse>("/users/login", { email, password }, { timeout: AUTH_TIMEOUT });
    await this.acceptAuth(response.data, revision);
  };

  register = async (username: string, email: string, password: string, bodyType: "BOY" | "GIRL") => {
    const revision = this.revision;
    const response = await this.client.post<AuthResponse>("/users/register", { username, email, password, bodyType }, { timeout: AUTH_TIMEOUT });
    await this.acceptAuth(response.data, revision);
  };

  logout = async () => {
    const revision = ++this.revision;
    await this.persist(null);
    if (revision === this.revision) {
      this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null });
    }
  };

  retrySession = () => this.state.token ? this.refreshUser() : this.restore();
}
